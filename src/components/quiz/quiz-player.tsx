"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRightIcon, ExternalLinkIcon, Loader2Icon, TrophyIcon } from "lucide-react";
import { toast } from "sonner";
import { answerQuestion } from "@/app/actions/quiz";
import { buttonVariants, Button } from "@/components/ui/button";
import type { AnswerFeedback, PublicQuestion } from "@/lib/quiz/engine";
import { cn } from "@/lib/utils";
import { ChoiceButton, type ChoiceState } from "./choice-button";
import { QuestionMeta } from "./question-meta";
import { ReportDialog } from "./report-dialog";
import { RoundTrack, type RoundState } from "./round-track";

type Props = {
  attemptId: string;
  title: string;
  questions: PublicQuestion[];
  initialFeedback: AnswerFeedback[];
};

export function QuizPlayer({ attemptId, title, questions, initialFeedback }: Props) {
  const [feedback, setFeedback] = useState<Record<string, AnswerFeedback>>(() =>
    Object.fromEntries(initialFeedback.map((f) => [f.questionId, f])),
  );
  const firstOpen = questions.findIndex((q) => !feedback[q.id]);
  const [index, setIndex] = useState(firstOpen === -1 ? questions.length - 1 : firstOpen);
  // 고른 보기는 문제 번호와 함께 저장해서, 다음 문제로 넘어가면 저절로 비워지게 한다
  const [picked, setPicked] = useState<{ index: number; choiceId: string } | null>(null);
  const selected = picked?.index === index ? picked.choiceId : null;
  const [pending, start] = useTransition();
  const shownAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const q = questions[index];
  const fb = q ? feedback[q.id] : undefined;
  const answeredCount = Object.keys(feedback).length;
  const finished = answeredCount >= questions.length;
  const isLast = index === questions.length - 1;

  useEffect(() => {
    shownAt.current = performance.now();
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  const rounds: RoundState[] = useMemo(
    () =>
      questions.map((qq, i) => {
        const f = feedback[qq.id];
        if (f) return f.correct ? "correct" : "wrong";
        return i === index ? "current" : "pending";
      }),
    [questions, feedback, index],
  );

  /** clickedAt: 클릭 이벤트의 timeStamp (performance.now 와 같은 기준) */
  function choose(choiceId: string, clickedAt: number) {
    if (!q || fb || pending) return;
    setPicked({ index, choiceId });
    const elapsedMs = Math.max(0, Math.round(clickedAt - shownAt.current));
    start(async () => {
      const res = await answerQuestion({ attemptId, questionId: q.id, choiceId, elapsedMs });
      if (!res.ok) {
        toast.error(res.error);
        setPicked(null);
        return;
      }
      setFeedback((prev) => ({ ...prev, [q.id]: res.feedback }));
    });
  }

  /** 다음 안 푼 문제로. 다 풀었으면 바로 다음 문제(해설 다시 보기) */
  function goNext() {
    const nextOpen = questions.findIndex((qq, i) => i > index && !feedback[qq.id]);
    setIndex(nextOpen !== -1 ? nextOpen : Math.min(index + 1, questions.length - 1));
  }

  function choiceState(choiceId: string): ChoiceState {
    if (!fb) return selected === choiceId ? "selected" : "idle";
    if (choiceId === fb.answerChoiceId) return "correct";
    if (choiceId === fb.choiceId) return "wrong";
    return "dimmed";
  }

  if (!q) return null;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">{title}</p>
          <p className="font-heading text-sm text-muted-foreground tabular-nums">
            {index + 1} / {questions.length}
          </p>
        </div>
        <RoundTrack states={rounds} />
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6" aria-live="polite">
        <QuestionMeta sport={q.sport} difficulty={q.difficulty} asOf={q.asOf} />
        <h1 ref={headingRef} tabIndex={-1} className="text-xl leading-snug font-bold outline-none sm:text-2xl">
          {q.stem}
        </h1>
        <div className="grid gap-2.5">
          {q.choices.map((c, i) => (
            <ChoiceButton key={c.id} index={i} text={c.text} state={choiceState(c.id)} disabled={!!fb || pending} onClick={(e) => choose(c.id, e.timeStamp)} />
          ))}
        </div>
        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> 판정 중…
          </p>
        )}
      </section>

      {fb && (
        <section
          className={cn(
            "animate-in space-y-3 rounded-2xl border-2 p-4 fade-in slide-in-from-bottom-2 sm:p-6",
            fb.correct ? "border-gold/60 bg-gold/10" : "border-primary/50 bg-primary/5",
          )}
        >
          <p className={cn("display-title text-2xl", fb.correct ? "text-gold" : "text-primary")}>{fb.correct ? "정답! 클린 히트" : "아쉽게 빗나갔어요"}</p>
          <p className="leading-relaxed">{fb.explanation}</p>
          {fb.sources.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {fb.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                    <ExternalLinkIcon className="size-3" /> {s.title ?? new URL(s.url).hostname}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <ReportDialog questionId={q.id} />
            {finished && isLast ? (
              <Link href={`/result/${attemptId}`} className={buttonVariants({ size: "lg", className: "h-11 px-5 font-bold" })}>
                <TrophyIcon /> 결과 보기
              </Link>
            ) : (
              <Button size="lg" className="h-11 px-5 font-bold" onClick={goNext}>
                {finished ? "다음 문제 보기" : "다음 라운드"} <ArrowRightIcon />
              </Button>
            )}
          </div>
          {finished && !isLast && (
            <Link href={`/result/${attemptId}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
              <TrophyIcon /> 결과 보기
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
