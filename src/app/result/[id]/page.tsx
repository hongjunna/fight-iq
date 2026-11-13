import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckIcon, XIcon } from "lucide-react";
import { BeltBadge } from "@/components/brand/belt-badge";
import { PageShell } from "@/components/layout/page-shell";
import { ShareButton } from "@/components/quiz/share-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FIREBASE_ENABLED } from "@/lib/features";
import { getPlayer, ownsAttempt } from "@/lib/player";
import { formatKoreanDate } from "@/lib/quiz/dates";
import { loadAttempt } from "@/lib/quiz/engine";
import { beltForIq, beltForRating } from "@/lib/quiz/rating";
import { SPORT_LABELS, type Sport } from "@/lib/quiz/taxonomy";
import { socialMetadata } from "@/lib/site";
import { cn } from "@/lib/utils";

const MODE_TITLES = { daily: "오늘의 5라운드", sparring: "스파링", test: "Fight IQ 테스트" } as const;

export async function generateMetadata({ params }: PageProps<"/result/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await loadAttempt(id);
  if (!data?.attempt.result || !data.attempt.finishedAt) return { title: "결과" };
  const r = data.attempt.result;
  const title = data.attempt.mode === "test" && r.iq ? `Fight IQ ${r.iq} · ${r.archetype}` : `${MODE_TITLES[data.attempt.mode]} ${r.correct}/${r.total}`;
  const description = "나의 격투 지식은 몇 점? Fight IQ에서 도전해 보세요.";
  return { title, description, robots: { index: false }, ...socialMetadata(title, description, `/result/${id}`) };
}

export default async function ResultPage({ params }: PageProps<"/result/[id]">) {
  const { id } = await params;
  const [data, player] = await Promise.all([loadAttempt(id), getPlayer()]);
  if (!data) notFound();
  const { attempt, questions, answers } = data;
  const mine = ownsAttempt(player, attempt);
  if (!attempt.finishedAt || !attempt.result) {
    if (mine) redirect(`/play/${attempt.id}`);
    notFound();
  }

  const r = attempt.result;
  const answerById = new Map(answers.map((a) => [a.questionId, a]));
  const strip = questions.map((q) => (answerById.get(q.id)?.correct ? "🟨" : "🟥")).join("");
  const modeTitle = MODE_TITLES[attempt.mode];
  const dateLabel = attempt.dailyDate ? formatKoreanDate(attempt.dailyDate) : null;
  const belt = r.iq ? beltForIq(r.iq) : null;
  const ratingBelt = r.ratingAfter != null ? beltForRating(r.ratingAfter) : null;

  const shareText =
    attempt.mode === "test" && r.iq
      ? `🥊 내 Fight IQ는 ${r.iq} — ${belt?.label}, ${r.archetype}\n${strip}`
      : `🥊 Fight IQ ${modeTitle}${dateLabel ? ` ${dateLabel}` : ""} ${r.correct}/${r.total}\n${strip}`;

  return (
    <PageShell narrow className="space-y-6">
      <section className="spotlight rounded-2xl border bg-card px-5 py-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          {modeTitle}
          {dateLabel && ` · ${dateLabel}`}
        </p>
        {attempt.mode === "test" && r.iq ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">Fight IQ</p>
            <p className="display-title text-8xl text-gold tabular-nums">{r.iq}</p>
            <p className="display-title mt-2 text-2xl">{r.archetype}</p>
            {belt && <BeltBadge belt={belt.id} label={belt.label} size="lg" className="mt-4" />}
          </>
        ) : (
          <>
            <p className="display-title mt-3 text-8xl tabular-nums">
              <span className="text-gold">{r.correct}</span>
              <span className="text-4xl text-muted-foreground"> / {r.total}</span>
            </p>
            <p className="mt-2 text-muted-foreground">{verdict(r.correct, r.total)}</p>
          </>
        )}
        <p className="mt-4 text-2xl tracking-widest" aria-label={`정답 ${r.correct}개, 오답 ${r.total - r.correct}개`}>
          {strip}
        </p>
      </section>

      {mine ? (
        <ShareButton text={shareText} url={`/result/${attempt.id}`} />
      ) : (
        <Link href={attempt.mode === "test" ? "/test" : attempt.mode === "daily" ? "/daily" : "/sparring"} className={buttonVariants({ size: "lg", className: "h-12 w-full text-base font-bold" })}>
          나도 도전하기
        </Link>
      )}

      {r.bySport && Object.keys(r.bySport).length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="display-title text-xl">종목별 정답률</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(r.bySport)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([sport, s]) => {
                const pct = Math.round((s.correct / s.total) * 100);
                return (
                  <div key={sport} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{SPORT_LABELS[sport as Sport] ?? sport}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.correct}/{s.total} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", pct >= 70 ? "bg-gold" : "bg-primary")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {mine && ratingBelt && r.ratingBefore != null && r.ratingAfter != null && (
        <Card size="sm">
          <CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">내 레이팅</p>
              <p className="font-heading text-2xl tabular-nums">
                {Math.round(r.ratingAfter)}{" "}
                <span className={cn("text-base", r.ratingAfter >= r.ratingBefore ? "text-success" : "text-primary")}>
                  {r.ratingAfter >= r.ratingBefore ? "▲" : "▼"} {Math.abs(Math.round(r.ratingAfter - r.ratingBefore))}
                </span>
              </p>
            </div>
            <BeltBadge belt={ratingBelt.id} label={ratingBelt.label} />
          </CardContent>
        </Card>
      )}

      {mine && (
        <Card>
          <CardHeader>
            <CardTitle className="display-title text-xl">라운드 다시 보기</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q, i) => {
              const a = answerById.get(q.id);
              const answer = q.content.ko.choices.find((c) => c.id === q.answerChoiceId)?.text;
              const picked = q.content.ko.choices.find((c) => c.id === a?.choiceId)?.text;
              return (
                <details key={q.id} className="group rounded-xl border p-3">
                  <summary className="flex list-none items-start gap-3">
                    <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md", a?.correct ? "bg-gold text-gold-foreground" : "bg-primary text-primary-foreground")}>
                      {a?.correct ? <CheckIcon className="size-4" /> : <XIcon className="size-4" />}
                    </span>
                    <span className="flex-1 text-sm">
                      <span className="mr-1 font-heading text-muted-foreground">R{i + 1}</span> {q.content.ko.stem}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 pl-9 text-sm">
                    <p>
                      정답: <strong className="text-gold">{answer}</strong>
                      {!a?.correct && picked && <span className="text-muted-foreground"> · 내 답: {picked}</span>}
                    </p>
                    <p className="text-muted-foreground">{q.content.ko.explanation}</p>
                  </div>
                </details>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href="/sparring" className={buttonVariants({ variant: "outline", size: "lg", className: "h-11" })}>
          스파링 더 하기
        </Link>
        <Link href="/test" className={buttonVariants({ variant: "outline", size: "lg", className: "h-11" })}>
          IQ 테스트
        </Link>
      </div>
      {mine && !player.user && FIREBASE_ENABLED && (
        <p className="text-center text-sm text-muted-foreground">
          <Link href={`/login?next=/result/${attempt.id}`} className="font-semibold text-primary underline-offset-2 hover:underline">
            로그인
          </Link>
          하면 기록이 저장되고 레이팅·벨트가 생겨요.
        </p>
      )}
    </PageShell>
  );
}

function verdict(correct: number, total: number) {
  const p = correct / total;
  if (p === 1) return "퍼펙트! 만장일치 판정승";
  if (p >= 0.8) return "판정승 — 훌륭한 경기였어요";
  if (p >= 0.6) return "스플릿 판정승";
  if (p >= 0.4) return "아쉬운 판정패";
  return "오늘은 코너에서 작전 회의가 필요해요";
}
