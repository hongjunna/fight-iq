/**
 * Fight IQ 문제 생성 워커.
 *
 *   tsx src/worker/main.ts                     상주: WORKER_HOURS(KST) 동안 WORKER_INTERVAL_MINUTES 마다 한 묶음씩,
 *                                              그리고 관리자 "지금 문제 생성하기" 요청은 시간대와 관계없이 바로
 *   tsx src/worker/main.ts --once --count 5    지금 바로 5개 주제만 처리하고 끝
 *
 * 관리자 요청: 웹이 generation_runs 에 kind='manual-pending' 행을 넣으면 워커가 30초 안에 가져가
 * 'manual-running' → 끝나면 'manual' 로 바꾼다.
 */
import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { generationItems, generationRuns } from "@/lib/db/schema";
import { config, inWorkingHours, windowStart } from "./config";
import { db, sql } from "./db";
import type { CallTrace } from "./llm";
import { runSubject, type Subject } from "./pipeline";
import { planSubjects } from "./planner";
import { saveResult } from "./store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...args: unknown[]) => console.log(new Date().toISOString(), "[worker]", ...args);
const TICK_MS = 30_000;
const MANUAL_MAX = 20;
let stopping = false;

async function waitForSchema() {
  for (let i = 0; ; i++) {
    try {
      await db.execute(dsql`select 1 from generation_items limit 1`);
      return;
    } catch {
      if (i % 6 === 0) log("DB·마이그레이션 대기 중 (웹 앱이 마이그레이션을 적용한다)");
      await sleep(10_000);
    }
  }
}

/** 이번 생성 시간대(예: 23시~다음 날 9시)에 이미 시도한 수 — 관리자 요청분은 빼고 센다 */
async function attemptsThisWindow() {
  const [row] = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(generationItems)
    .innerJoin(generationRuns, eq(generationRuns.id, generationItems.runId))
    .where(and(gte(generationItems.createdAt, windowStart()), eq(generationRuns.kind, "batch")));
  return row?.n ?? 0;
}

/** 관리자 요청 하나를 가져온다 (여러 워커가 떠도 하나만 가져가도록 잠금) */
async function claimManualRequest(): Promise<{ id: string; count: number } | null> {
  const rows = await db.execute<{ id: string; stats: { requested?: number } }>(dsql`
    update generation_runs set kind = 'manual-running', started_at = now()
    where id = (select id from generation_runs where kind = 'manual-pending' order by started_at limit 1 for update skip locked)
    returning id, stats`);
  const row = rows[0];
  if (!row) return null;
  const requested = Number(row.stats?.requested);
  return { id: row.id, count: Math.min(MANUAL_MAX, Number.isFinite(requested) && requested > 0 ? requested : config.batchSize) };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined && !stopping; item = queue.shift()) await fn(item);
    }),
  );
}

async function runBatch(count: number, manual?: { id: string }) {
  const runId = manual?.id ?? (await db.insert(generationRuns).values({ kind: "batch" }).returning({ id: generationRuns.id }))[0].id;
  const planCalls: CallTrace[] = [];
  const stats: Record<string, number> = { requested: count, planned: 0, published: 0, review: 0, rejected: 0, error: 0, llm_calls: 0 };
  try {
    const subjects: Subject[] = await planSubjects(count, planCalls);
    stats.planned = subjects.length;
    stats.llm_calls = planCalls.length;
    log(`${manual ? "관리자 요청" : "정기"} 묶음 시작: 주제 ${subjects.length}개`);

    await pool(subjects, config.concurrency, async (subject) => {
      const started = Date.now();
      const result = await runSubject(subject);
      const seconds = Math.round((Date.now() - started) / 1000);
      const saved = await saveResult(runId, subject, result, seconds);
      stats[saved.verdict] = (stats[saved.verdict] ?? 0) + 1;
      stats.llm_calls += result.calls.length;
      log(`${saved.verdict.padEnd(9)} ${subject.sport}/${subject.topic} ${seconds}s ${saved.reason ?? ""} — ${subject.brief}`);
    });
  } finally {
    await db
      .update(generationRuns)
      .set({ stats, finishedAt: new Date(), ...(manual ? { kind: stopping ? "manual-interrupted" : "manual" } : {}) })
      .where(eq(generationRuns.id, runId));
    log("묶음 끝", stats);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const once = args.includes("--once");
  const countArg = Number(args[args.indexOf("--count") + 1]);

  if (!config.bridgeKey) {
    log("FIQ_BRIDGE_KEY 가 없어 생성하지 않습니다. .env 에 브릿지 키를 넣으면 시작합니다.");
    if (once) return;
    for (;;) await sleep(3_600_000);
  }
  await waitForSchema();

  if (once) {
    await runBatch(Number.isFinite(countArg) && countArg > 0 ? countArg : config.batchSize);
    return;
  }

  // 지난번에 처리 도중 멈춘 관리자 요청은 '중단됨'으로 정리
  await db.update(generationRuns).set({ kind: "manual-interrupted", finishedAt: new Date() }).where(eq(generationRuns.kind, "manual-running"));

  const [start, end] = config.hours;
  log(`상주 시작 — 정기 생성 ${start}시~${end}시 전(KST${start > end ? ", 자정 넘김" : ""}), ${config.intervalMinutes}분 간격, 시간대당 최대 ${config.dailyCandidates}개. 관리자 요청은 ${TICK_MS / 1000}초마다 확인`);

  const wait = async (ms: number) => {
    for (let waited = 0; waited < ms && !stopping; waited += 5_000) await sleep(5_000);
  };
  // 정기 생성과 관리자 요청은 따로 돈다 — 정기 묶음이 도는 중에도 버튼을 누르면 바로 시작한다.
  // 분당 호출 한도·브릿지 사용률 대기는 프로세스 전체에서 공유하므로 둘이 겹쳐도 브릿지 부담은 같다.
  const scheduledLoop = async () => {
    while (!stopping) {
      try {
        if (inWorkingHours()) {
          const remaining = config.dailyCandidates - (await attemptsThisWindow());
          if (remaining > 0) await runBatch(Math.min(config.batchSize, remaining));
        }
      } catch (error) {
        log("정기 묶음 실패", error);
      }
      await wait(config.intervalMinutes * 60_000);
    }
  };
  const manualLoop = async () => {
    while (!stopping) {
      try {
        const manual = await claimManualRequest();
        if (manual) {
          await runBatch(manual.count, manual);
          continue;
        }
      } catch (error) {
        log("관리자 요청 실패", error);
      }
      await wait(TICK_MS);
    }
  };
  await Promise.all([scheduledLoop(), manualLoop()]);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    log(`${signal} — 지금 주제까지만 마치고 멈춥니다`);
    stopping = true;
    setTimeout(() => process.exit(0), 8_000).unref();
  });
}

main()
  .catch((error) => {
    log("치명적 오류", error);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
