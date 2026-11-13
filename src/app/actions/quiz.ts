"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions, reports } from "@/lib/db/schema";
import { getPlayer } from "@/lib/player";
import { isSport, QuizError, startAttempt, submitAnswer, type AnswerFeedback } from "@/lib/quiz/engine";
import { eq } from "drizzle-orm";

export type StartState = { error?: string };

export async function startQuiz(_prev: StartState, formData: FormData): Promise<StartState> {
  const mode = formData.get("mode");
  if (mode !== "daily" && mode !== "sparring" && mode !== "test") return { error: "알 수 없는 모드입니다" };

  const sport = formData.get("sport");
  const difficulty = Number(formData.get("difficulty"));
  let attemptId: string;
  try {
    attemptId = await startAttempt(await getPlayer(), mode, {
      sport: isSport(sport) ? sport : undefined,
      difficulty: difficulty >= 1 && difficulty <= 5 ? difficulty : undefined,
    });
  } catch (error) {
    if (error instanceof QuizError) return { error: error.message };
    console.error("[quiz] start failed", error);
    return { error: "퀴즈를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  redirect(`/play/${attemptId}`);
}

const answerSchema = z.object({
  attemptId: z.uuid(),
  questionId: z.uuid(),
  choiceId: z.string().regex(/^[a-z]$/),
  elapsedMs: z.number().int().nonnegative().nullable(),
});

export type AnswerResult = { ok: true; feedback: AnswerFeedback; finished: boolean } | { ok: false; error: string };

export async function answerQuestion(input: z.infer<typeof answerSchema>): Promise<AnswerResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "잘못된 요청입니다" };
  const { attemptId, questionId, choiceId, elapsedMs } = parsed.data;
  try {
    const { feedback, finished } = await submitAnswer(await getPlayer(), attemptId, questionId, choiceId, elapsedMs);
    return { ok: true, feedback, finished };
  } catch (error) {
    if (error instanceof QuizError) return { ok: false, error: error.message };
    console.error("[quiz] answer failed", error);
    return { ok: false, error: "답을 저장하지 못했습니다. 다시 눌러 주세요." };
  }
}

const reportSchema = z.object({
  questionId: z.uuid(),
  reason: z.enum(["wrong_answer", "outdated", "ambiguous", "other"]),
  note: z.string().trim().max(1000).optional(),
});

export async function reportQuestion(input: z.infer<typeof reportSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "잘못된 요청입니다" };
  const [q] = await db.select({ version: questions.version }).from(questions).where(eq(questions.id, parsed.data.questionId)).limit(1);
  if (!q) return { ok: false, error: "문제를 찾을 수 없습니다" };
  const player = await getPlayer();
  await db.insert(reports).values({
    questionId: parsed.data.questionId,
    questionVersion: q.version,
    userId: player.user?.id ?? null,
    anonId: player.anonId,
    reason: parsed.data.reason,
    note: parsed.data.note || null,
  });
  return { ok: true };
}
