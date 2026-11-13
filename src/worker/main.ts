/**
 * Fight IQ 문제 생성 워커.
 *
 *   tsx src/worker/main.ts                 상주: WORKER_HOURS(KST) 동안 WORKER_INTERVAL_MINUTES 마다 한 묶음씩
 *   tsx src/worker/main.ts --once --count 5    지금 바로 5개 주제만 처리하고 끝
 */
import { eq, gte, sql as dsql } from "drizzle-orm";
import { generationItems, generationRuns } from "@/lib/db/schema";
import { config, inWorkingHours } from "./config";
import { db, sql } from "./db";
import type { CallTrace } from "./llm";
import { runSubject, type Subject } from "./pipeline";
import { planSubjects } from "./planner";
import { saveResult } from "./store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...args: unknown[]) => console.log(new Date().toISOString(), "[worker]", ...args);
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

async function attemptsToday() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const [row] = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(generationItems)
    .where(gte(generationItems.createdAt, dsql`(${today}::date at time zone 'Asia/Seoul')`));
  return row?.n ?? 0;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined && !stopping; item = queue.shift()) await fn(item);
    }),
  );
}

async function runBatch(count: number) {
  const [run] = await db.insert(generationRuns).values({ kind: "batch" }).returning({ id: generationRuns.id });
  const planCalls: CallTrace[] = [];
  const subjects: Subject[] = await planSubjects(count, planCalls);
  log(`묶음 시작: 주제 ${subjects.length}개`);
  const stats: Record<string, number> = { planned: subjects.length, published: 0, review: 0, rejected: 0, error: 0, llm_calls: planCalls.length };

  await pool(subjects, config.concurrency, async (subject) => {
    const started = Date.now();
    const result = await runSubject(subject);
    const seconds = Math.round((Date.now() - started) / 1000);
    const saved = await saveResult(run.id, subject, result, seconds);
    stats[saved.verdict] = (stats[saved.verdict] ?? 0) + 1;
    stats.llm_calls += result.calls.length;
    log(`${saved.verdict.padEnd(9)} ${subject.sport}/${subject.topic} ${seconds}s ${saved.reason ?? ""} — ${subject.brief}`);
  });

  await db.update(generationRuns).set({ stats, finishedAt: new Date() }).where(eq(generationRuns.id, run.id));
  log("묶음 끝", stats);
  return stats;
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

  log(`상주 시작 — 시간대 ${config.hours[0]}~${config.hours[1]}시(KST), ${config.intervalMinutes}분 간격, 하루 최대 ${config.dailyCandidates}개`);
  while (!stopping) {
    try {
      if (inWorkingHours()) {
        const remaining = config.dailyCandidates - (await attemptsToday());
        if (remaining > 0) await runBatch(Math.min(config.batchSize, remaining));
      }
    } catch (error) {
      log("묶음 실패", error);
    }
    for (let waited = 0; waited < config.intervalMinutes * 60 && !stopping; waited += 5) await sleep(5_000);
  }
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
