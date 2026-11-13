import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { QuestionEditor } from "@/components/admin/question-editor";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { facts, generationItems, questionFacts, questions, reports } from "@/lib/db/schema";
import { resolveReport } from "../../actions";
import { updateQuestion } from "../actions";

export const metadata: Metadata = { title: "문제 편집", robots: { index: false } };
export const dynamic = "force-dynamic";

const REASON_LABELS = { wrong_answer: "정답 오류", outdated: "오래된 정보", ambiguous: "애매함", other: "기타" } as const;
const REPORT_STATUS = { open: "열림", resolved: "처리됨", dismissed: "기각" } as const;
const GEN_LABELS = { published: "자동 게시", review: "검수 대기", rejected: "폐기", error: "오류" } as const;

type Attempt = {
  generator?: string;
  mechanical?: string[];
  removedSentences?: string[];
  check?: { issues?: string } | null;
  blind?: Record<string, { choice_id?: string; true_distractors?: string[]; comment?: string }>;
};

export default async function AdminQuestionPage({ params }: PageProps<"/admin/questions/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [q] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!q) notFound();

  const [linkedFacts, questionReports, [gen]] = await Promise.all([
    db.select({ f: facts }).from(questionFacts).innerJoin(facts, eq(facts.id, questionFacts.factId)).where(eq(questionFacts.questionId, id)),
    db.select().from(reports).where(eq(reports.questionId, id)).orderBy(desc(reports.createdAt)).limit(50),
    db.select().from(generationItems).where(eq(generationItems.questionId, id)).orderBy(desc(generationItems.createdAt)).limit(1),
  ]);

  const ko = q.content.ko;
  const en = q.content.en;
  const acc = q.timesAnswered ? Math.round((q.timesCorrect / q.timesAnswered) * 100) : null;
  const attempts = ((gen?.trace as { attempts?: Attempt[] } | undefined)?.attempts ?? []).filter(Boolean);
  const finalAttempt = attempts[attempts.length - 1];

  return (
    <PageShell>
      <Link href="/admin/questions" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> 문제 목록
      </Link>
      <h1 className="display-title mb-4 text-2xl sm:text-3xl">문제 편집</h1>
      <AdminNav current="/admin/questions" />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent>
            <QuestionEditor
              key={`${q.id}-${q.version}-${q.updatedAt.toISOString()}`}
              action={updateQuestion.bind(null, q.id)}
              initial={{
                stem: ko.stem,
                choices: ko.choices,
                answer: q.answerChoiceId,
                explanation: ko.explanation,
                sport: q.sport,
                topics: q.topics,
                difficulty: q.difficulty,
                status: q.status,
                temporalKind: q.temporal.kind,
                asOf: q.temporal.kind === "as_of" ? q.temporal.as_of : "",
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>현황</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                정답률 {acc === null ? "—" : `${acc}%`} · 풀이 {q.timesAnswered.toLocaleString()}회 · 실측 레이팅 {Math.round(q.rating)}
              </p>
              <p className="text-muted-foreground">
                버전 {q.version} · 만든 날 {q.createdAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} · 고친 날{" "}
                {q.updatedAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
              </p>
              <p className="font-mono text-[11px] break-all text-muted-foreground">{q.id}</p>
            </CardContent>
          </Card>

          {questionReports.length > 0 && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>신고 {questionReports.length}건</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {questionReports.map((r) => (
                  <div key={r.id} className="space-y-1 rounded-lg border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={r.status === "open" ? "destructive" : "outline"}>{REASON_LABELS[r.reason]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {REPORT_STATUS[r.status]} · v{r.questionVersion} · {r.createdAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </span>
                    </div>
                    {r.note && <p>“{r.note}”</p>}
                    {r.status === "open" && (
                      <form action={resolveReport.bind(null, r.id, "dismissed", false)}>
                        <Button size="xs" variant="outline">
                          기각
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">문항·보기·정답·해설을 고쳐 저장하면 열린 신고는 처리됨으로 바뀝니다.</p>
              </CardContent>
            </Card>
          )}

          <Card size="sm">
            <CardHeader>
              <CardTitle>출처 {q.sources.length}개</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {q.sources.length === 0 && <p className="text-muted-foreground">출처가 없습니다.</p>}
              {q.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 break-all text-muted-foreground hover:text-foreground">
                  <ExternalLinkIcon className="size-3 shrink-0" /> {s.url}
                </a>
              ))}
            </CardContent>
          </Card>

          {gen && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>AI 생성 기록</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{GEN_LABELS[gen.verdict]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {gen.seconds}초 · 모델 호출 {gen.llmCalls}회 · 위험도 {gen.risk}
                  </span>
                </div>
                <p>{gen.brief}</p>
                {gen.reason && <p className="text-muted-foreground">판정 사유: {gen.reason}</p>}
                {finalAttempt?.generator && <p className="text-xs text-muted-foreground">생성 {finalAttempt.generator} · 시도 {attempts.length}회</p>}
                {finalAttempt?.check?.issues && <p className="text-xs text-muted-foreground">근거 대조: {finalAttempt.check.issues}</p>}
                {finalAttempt?.removedSentences && finalAttempt.removedSentences.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    근거가 없어 지운 해설 문장:
                    <ul className="mt-1 list-disc pl-4">
                      {finalAttempt.removedSentences.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {finalAttempt?.blind && (
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {Object.entries(finalAttempt.blind).map(([m, b]) => (
                      <li key={m}>
                        블라인드 {m}: {b.choice_id} {b.choice_id === q.answerChoiceId ? "✓" : "✗"}
                        {b.true_distractors?.length ? ` · 현실에서 맞을 수 있는 오답 ${b.true_distractors.join(",")}` : ""}
                        {b.comment ? ` — ${b.comment}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {linkedFacts.length > 0 && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>근거 사실 {linkedFacts.length}개</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {linkedFacts.map(({ f }) => (
                  <div key={f.id} className="space-y-1">
                    <p>{f.statementEn}</p>
                    {f.sources.slice(0, 2).map((s) => (
                      <p key={s.url} className="text-xs text-muted-foreground">
                        “{s.title}” — {new URL(s.url).hostname}
                      </p>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {en && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>영어판 (비공개 보관)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{en.stem}</p>
                <ul className="text-muted-foreground">
                  {en.choices.map((c) => (
                    <li key={c.id} className={c.id === q.answerChoiceId ? "font-semibold text-gold" : undefined}>
                      {c.id}) {c.text}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground">{en.explanation}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
