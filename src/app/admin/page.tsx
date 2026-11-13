import type { Metadata } from "next";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { ImportForm } from "@/components/admin/import-form";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { QuestionMeta } from "@/components/quiz/question-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasAdminCookie, requireAdmin } from "@/lib/admin";
import { adminLogout } from "./login/actions";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { GenerateNow, type ManualRun } from "@/components/admin/generate-now";
import { attempts, generationItems, generationRuns, questions, reports, type Question } from "@/lib/db/schema";
import { todayKst } from "@/lib/quiz/dates";
import type { Sport } from "@/lib/quiz/taxonomy";
import { cn } from "@/lib/utils";
import { resolveReport, setQuestionStatus } from "./actions";

export const metadata: Metadata = { title: "관리자", robots: { index: false } };
export const dynamic = "force-dynamic";

const REASON_LABELS = { wrong_answer: "정답 오류", outdated: "오래된 정보", ambiguous: "애매함", other: "기타" } as const;
const STATUS_LABELS = { draft: "초안", review: "검수 대기", published: "게시", retired: "내림" } as const;
const GEN_LABELS = { published: "자동 게시", review: "검수 대기", rejected: "폐기", error: "오류" } as const;

export default async function AdminPage() {
  await requireAdmin();
  const [statusCounts, reviewQueue, openReports, [todayAttempts], suspicious, genItems, genWeek] = await Promise.all([
    db.select({ status: questions.status, n: count() }).from(questions).groupBy(questions.status),
    db.select().from(questions).where(eq(questions.status, "review")).orderBy(desc(questions.createdAt)).limit(30),
    db
      .select({ report: reports, question: questions })
      .from(reports)
      .innerJoin(questions, eq(questions.id, reports.questionId))
      .where(eq(reports.status, "open"))
      .orderBy(desc(reports.createdAt))
      .limit(50),
    db.select({ n: count() }).from(attempts).where(sql`${attempts.startedAt} >= (${todayKst()}::date at time zone 'Asia/Seoul')`),
    // 난이도에 비해 정답률이 너무 낮은 문제 — 정답 오류·애매함 의심 (기획서 §9)
    db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.status, "published"),
          sql`${questions.timesAnswered} >= 20`,
          sql`${questions.timesCorrect}::float / ${questions.timesAnswered} < case when ${questions.difficulty} <= 2 then 0.35 else 0.15 end`,
        ),
      )
      .limit(20),
    db.select().from(generationItems).orderBy(desc(generationItems.createdAt)).limit(25),
    db
      .select({ verdict: generationItems.verdict, n: count(), calls: sql<number>`sum(${generationItems.llmCalls})::int` })
      .from(generationItems)
      .where(sql`${generationItems.createdAt} > now() - interval '7 days'`)
      .groupBy(generationItems.verdict),
  ]);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s.n])) as Partial<Record<keyof typeof STATUS_LABELS, number>>;

  // 최근 "지금 문제 생성하기" 요청 — 진행 중이면 지금까지 처리한 결과를 바로 센다
  const [lastManualRow] = await db
    .select()
    .from(generationRuns)
    .where(sql`${generationRuns.kind} like 'manual%'`)
    .orderBy(desc(generationRuns.startedAt))
    .limit(1);
  let lastManual: ManualRun = null;
  if (lastManualRow) {
    const stats = { ...(lastManualRow.stats as Record<string, number>) };
    if (!lastManualRow.finishedAt) {
      const live = await db
        .select({ verdict: generationItems.verdict, n: count() })
        .from(generationItems)
        .where(eq(generationItems.runId, lastManualRow.id))
        .groupBy(generationItems.verdict);
      for (const l of live) stats[l.verdict] = l.n;
    }
    lastManual = {
      kind: lastManualRow.kind,
      startedAt: lastManualRow.startedAt.toISOString(),
      finishedAt: lastManualRow.finishedAt?.toISOString() ?? null,
      stats,
    };
  }

  return (
    <PageShell className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageTitle eyebrow="Admin" title="운영 콘솔" />
        {(await hasAdminCookie()) && (
          <form action={adminLogout}>
            <Button variant="outline" size="sm">관리자 나가기</Button>
          </form>
        )}
      </div>
      <AdminNav current="/admin" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => (
          <Stat key={s} label={STATUS_LABELS[s]} value={counts[s] ?? 0} />
        ))}
        <Stat label="오늘 시작된 풀이" value={todayAttempts?.n ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="display-title text-xl">신고 {openReports.length}건</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {openReports.length === 0 && <p className="text-sm text-muted-foreground">처리할 신고가 없습니다.</p>}
          {openReports.map(({ report, question }) => (
            <div key={report.id} className="space-y-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">{REASON_LABELS[report.reason]}</Badge>
                <span className="text-xs text-muted-foreground">{report.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
              </div>
              {report.note && <p className="text-sm">“{report.note}”</p>}
              <QuestionPreview q={question} />
              <div className="flex flex-wrap gap-2">
                <form action={resolveReport.bind(null, report.id, "resolved", true)}>
                  <Button size="sm" variant="destructive">문제 내리고 처리</Button>
                </form>
                <form action={resolveReport.bind(null, report.id, "dismissed", false)}>
                  <Button size="sm" variant="outline">기각</Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {suspicious.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="display-title text-xl">정답률 이상 문제 {suspicious.length}개</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suspicious.map((q) => (
              <div key={q.id} className="space-y-2 rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">
                  정답률 {Math.round((q.timesCorrect / q.timesAnswered) * 100)}% ({q.timesAnswered}회)
                </p>
                <QuestionPreview q={q} />
                <form action={setQuestionStatus.bind(null, [q.id], "review")}>
                  <Button size="sm" variant="outline">검수 대기로 내리기</Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="display-title text-xl">검수 대기 {counts.review ?? 0}개</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviewQueue.length > 1 && (
            <form action={setQuestionStatus.bind(null, reviewQueue.map((q) => q.id), "published")}>
              <Button size="sm" variant="secondary">아래 {reviewQueue.length}개 모두 게시</Button>
            </form>
          )}
          {reviewQueue.length === 0 && <p className="text-sm text-muted-foreground">검수할 문제가 없습니다.</p>}
          {reviewQueue.map((q) => (
            <div key={q.id} className="space-y-2 rounded-xl border p-3">
              <QuestionPreview q={q} showProvenance />
              <div className="flex gap-2">
                <form action={setQuestionStatus.bind(null, [q.id], "published")}>
                  <Button size="sm">게시</Button>
                </form>
                <form action={setQuestionStatus.bind(null, [q.id], "retired")}>
                  <Button size="sm" variant="outline">폐기</Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="display-title text-xl">AI 생성 (최근 7일)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <GenerateNow last={lastManual} />
          <div className="flex flex-wrap gap-2 text-sm">
            {genWeek.length === 0 && <span className="text-muted-foreground">아직 생성 기록이 없습니다. 워커는 .env 의 FIQ_BRIDGE_KEY 가 있어야 동작합니다.</span>}
            {genWeek.map((g) => (
              <Badge key={g.verdict} variant={g.verdict === "published" ? "default" : g.verdict === "review" ? "secondary" : "outline"}>
                {GEN_LABELS[g.verdict]} {g.n}
              </Badge>
            ))}
            {genWeek.length > 0 && <span className="text-muted-foreground">모델 호출 {genWeek.reduce((s, g) => s + (g.calls ?? 0), 0).toLocaleString()}회</span>}
          </div>
          <ul className="divide-y text-sm">
            {genItems.map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                <Badge variant={g.verdict === "published" ? "default" : g.verdict === "review" ? "secondary" : "outline"}>{GEN_LABELS[g.verdict]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {g.sport}/{g.topic} · {g.seconds}초 · {g.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                </span>
                <span className="w-full">{g.brief}</span>
                {g.reason && <span className="w-full text-xs text-muted-foreground">{g.reason}</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="display-title text-xl">문제 가져오기 (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl tabular-nums">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function QuestionPreview({ q, showProvenance = false }: { q: Question; showProvenance?: boolean }) {
  const ko = q.content.ko;
  return (
    <div className="space-y-2 text-sm">
      <QuestionMeta sport={q.sport as Sport} difficulty={q.difficulty} asOf={q.temporal.kind === "as_of" ? q.temporal.as_of : null} />
      <p className="font-medium">{ko.stem}</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {ko.choices.map((c) => (
          <li key={c.id} className={cn("rounded-md border px-2 py-1", c.id === q.answerChoiceId && "border-gold bg-gold/10 font-semibold")}>
            {c.id}) {c.text}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">{ko.explanation}</p>
      {q.sources.length > 0 && (
        <p className="truncate text-xs text-muted-foreground">
          출처:{" "}
          {q.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="mr-2 underline">
              {new URL(s.url).hostname}
            </a>
          ))}
        </p>
      )}
      {showProvenance && Object.keys(q.provenance).length > 0 && (
        <p className="truncate font-mono text-[11px] text-muted-foreground">{JSON.stringify(q.provenance)}</p>
      )}
    </div>
  );
}
