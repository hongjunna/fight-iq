import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { QuizPlayer } from "@/components/quiz/quiz-player";
import { getPlayer, ownsAttempt } from "@/lib/player";
import { formatKoreanDate } from "@/lib/quiz/dates";
import { feedbackFor, loadAttempt, toPublicQuestion } from "@/lib/quiz/engine";

export const metadata: Metadata = { title: "풀이", robots: { index: false } };

const TITLES = { daily: "오늘의 5라운드", sparring: "스파링", test: "Fight IQ 테스트" } as const;

export default async function PlayPage({ params }: PageProps<"/play/[id]">) {
  const { id } = await params;
  const [data, player] = await Promise.all([loadAttempt(id), getPlayer()]);
  if (!data || !ownsAttempt(player, data.attempt)) notFound();
  const { attempt, questions, answers } = data;
  if (attempt.finishedAt && answers.length >= questions.length) redirect(`/result/${attempt.id}`);

  const byId = new Map(questions.map((q) => [q.id, q]));
  const initialFeedback = answers.flatMap((a) => {
    const q = byId.get(a.questionId);
    return q ? [feedbackFor(q, a.choiceId)] : [];
  });
  const title = attempt.mode === "daily" && attempt.dailyDate ? `${TITLES.daily} · ${formatKoreanDate(attempt.dailyDate)}` : TITLES[attempt.mode];

  return (
    <PageShell narrow>
      <QuizPlayer
        attemptId={attempt.id}
        title={title}
        questions={questions.map((q) => toPublicQuestion(q, attempt.id))}
        initialFeedback={initialFeedback}
      />
    </PageShell>
  );
}
