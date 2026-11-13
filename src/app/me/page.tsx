import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, or, type SQL } from "drizzle-orm";
import { BeltBadge } from "@/components/brand/belt-badge";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { attemptAnswers, attempts, questions } from "@/lib/db/schema";
import { FIREBASE_ENABLED } from "@/lib/features";
import { getPlayer } from "@/lib/player";
import { formatKoreanDate } from "@/lib/quiz/dates";
import { beltForRating } from "@/lib/quiz/rating";

export const metadata: Metadata = { title: "내 기록", robots: { index: false } };
export const dynamic = "force-dynamic";

const MODE_TITLES = { daily: "오늘의 5라운드", sparring: "스파링", test: "Fight IQ 테스트" } as const;

export default async function MePage() {
  const player = await getPlayer();
  const owner: SQL[] = [];
  if (player.user) owner.push(eq(attempts.userId, player.user.id));
  if (player.anonId) owner.push(eq(attempts.anonId, player.anonId));
  const ownerWhere = owner.length ? or(...owner) : undefined;

  const [recent, wrong] = ownerWhere
    ? await Promise.all([
        db.select().from(attempts).where(ownerWhere).orderBy(desc(attempts.startedAt)).limit(15),
        db
          .select({ q: questions, choiceId: attemptAnswers.choiceId, at: attemptAnswers.answeredAt })
          .from(attemptAnswers)
          .innerJoin(attempts, eq(attempts.id, attemptAnswers.attemptId))
          .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
          .where(and(ownerWhere, eq(attemptAnswers.correct, false)))
          .orderBy(desc(attemptAnswers.answeredAt))
          .limit(20),
      ])
    : [[], []];

  const belt = player.user ? beltForRating(player.user.rating) : null;

  return (
    <PageShell>
      <PageTitle eyebrow="My Corner" title="내 기록" />

      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          {player.user && belt ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">Fight IQ 레이팅</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="display-title text-6xl tabular-nums">{Math.round(player.user.rating)}</p>
                <BeltBadge belt={belt.id} label={belt.label} />
                <p className="text-xs text-muted-foreground">어려운 문제를 맞힐수록 크게 오릅니다. 틀려도 쉬운 문제일수록 조금 더 내려가요.</p>
              </CardContent>
            </Card>
          ) : FIREBASE_ENABLED ? (
            <Card>
              <CardHeader>
                <CardTitle className="display-title text-xl">기록을 지키세요</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  지금은 이 브라우저에만 기록이 남아요. 로그인하면 지금까지 푼 기록을 계정으로 옮기고 레이팅과 벨트가 생깁니다.
                </p>
                <GoogleSignInButton next="/me" />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="display-title text-xl">이 브라우저의 기록</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  기록은 이 브라우저에 저장됩니다. 계정 기능(레이팅·벨트, 기기 간 기록 이동)은 곧 추가될 예정이에요.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="display-title text-xl">최근 경기</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  아직 기록이 없어요.{" "}
                  <Link href="/daily" className="text-primary underline-offset-2 hover:underline">
                    오늘의 5라운드
                  </Link>
                  부터 시작해 보세요.
                </p>
              ) : (
                <ul className="divide-y">
                  {recent.map((a) => (
                    <li key={a.id}>
                      <Link href={a.finishedAt ? `/result/${a.id}` : `/play/${a.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-primary">
                        <span>
                          {MODE_TITLES[a.mode]}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {a.dailyDate ? formatKoreanDate(a.dailyDate) : a.startedAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                          </span>
                        </span>
                        <span className="font-heading tabular-nums">
                          {a.finishedAt ? (a.result?.iq ? `IQ ${a.result.iq}` : `${a.result?.correct}/${a.result?.total}`) : "진행 중"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="display-title text-xl">코너 — 틀린 문제 복습</CardTitle>
          </CardHeader>
          <CardContent>
            {wrong.length === 0 ? (
              <p className="text-sm text-muted-foreground">틀린 문제가 여기 모여요. 세컨드의 조언처럼 해설을 다시 읽어 보세요.</p>
            ) : (
              <ul className="space-y-3">
                {wrong.map(({ q, choiceId, at }) => {
                  const answer = q.content.ko.choices.find((c) => c.id === q.answerChoiceId)?.text;
                  const picked = q.content.ko.choices.find((c) => c.id === choiceId)?.text;
                  return (
                    <li key={`${q.id}-${at.toISOString()}`} className="rounded-xl border p-3 text-sm">
                      <p className="font-medium">{q.content.ko.stem}</p>
                      <p className="mt-1.5">
                        정답 <strong className="text-gold">{answer}</strong>
                        <span className="text-muted-foreground"> · 내 답 {picked}</span>
                      </p>
                      <p className="mt-1.5 text-muted-foreground">{q.content.ko.explanation}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
