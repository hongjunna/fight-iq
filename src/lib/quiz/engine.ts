import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  attemptAnswers,
  attempts,
  dailySets,
  questions,
  users,
  type Attempt,
  type AttemptResult,
  type Question,
  type QuizMode,
} from "@/lib/db/schema";
import type { Player } from "@/lib/player";
import { todayKst } from "./dates";
import { beltForIq, fightIq, initialQuestionRating, updateRatings } from "./rating";
import { questionFingerprint, type QuestionInput, type Source } from "./schema";
import { SPORT_ARCHETYPES, SPORTS, type Sport } from "./taxonomy";

export const MODE_SIZES: Record<QuizMode, number> = { daily: 5, sparring: 10, test: 20 };

export class QuizError extends Error {}

// --- 화면에 내려보내는 문제 (정답 제외) ----------------------------------------------

export type PublicQuestion = {
  id: string;
  sport: Sport;
  topics: string[];
  difficulty: number;
  stem: string;
  choices: { id: string; text: string }[];
  asOf: string | null;
};

/** 같은 시도·문제에서는 늘 같은 순서가 나오도록 보기를 섞는다 (AI 가 정답을 특정 위치에 몰아 두는 경향 보정) */
function seededShuffle<T>(items: T[], seed: string) {
  const out = [...items];
  let h = createHash("sha256").update(seed).digest();
  for (let i = out.length - 1; i > 0; i--) {
    if (i % 8 === 0) h = createHash("sha256").update(h).digest();
    const j = h[i % 32] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function toPublicQuestion(q: Question, seed: string): PublicQuestion {
  const ko = q.content.ko;
  return {
    id: q.id,
    sport: q.sport as Sport,
    topics: q.topics,
    difficulty: q.difficulty,
    stem: ko.stem,
    choices: q.type === "true_false" ? ko.choices : seededShuffle(ko.choices, `${seed}:${q.id}`),
    asOf: q.temporal.kind === "as_of" ? q.temporal.as_of : null,
  };
}

// --- 문제 고르기 ----------------------------------------------------------------------

async function randomPublished(count: number, where: (SQL | undefined)[] = []) {
  if (count <= 0) return [];
  return db
    .select({ id: questions.id, difficulty: questions.difficulty, sport: questions.sport })
    .from(questions)
    .where(and(eq(questions.status, "published"), ...where))
    .orderBy(sql`random()`)
    .limit(count);
}

/** 이 사람이 최근에 푼 문제 (가능하면 다시 내지 않는다) */
async function recentlySeen(player: Player, limit = 300) {
  const owner = playerFilter(player);
  if (!owner) return [];
  const rows = await db
    .select({ questionId: attemptAnswers.questionId })
    .from(attemptAnswers)
    .innerJoin(attempts, eq(attempts.id, attemptAnswers.attemptId))
    .where(owner)
    .orderBy(desc(attemptAnswers.answeredAt))
    .limit(limit);
  return rows.map((r) => r.questionId);
}

function playerFilter(player: Player) {
  const conds: SQL[] = [];
  if (player.user) conds.push(eq(attempts.userId, player.user.id));
  if (player.anonId) conds.push(eq(attempts.anonId, player.anonId));
  return conds.length ? or(...conds) : undefined;
}

/** 안 푼 문제 우선, 모자라면 푼 문제로 채운다 */
async function pickFresh(count: number, seen: string[], where: (SQL | undefined)[] = []) {
  const fresh = await randomPublished(count, [...where, seen.length ? notInArray(questions.id, seen) : undefined]);
  if (fresh.length >= count) return fresh;
  const more = await randomPublished(count - fresh.length, [
    ...where,
    fresh.length ? notInArray(questions.id, fresh.map((f) => f.id)) : undefined,
  ]);
  return [...fresh, ...more];
}

/** 오늘의 5라운드: 날짜마다 한 번 정해서 전원에게 같은 문제. 난이도는 1→4 로 올라간다 */
export async function getOrCreateDailySet(date = todayKst()) {
  const [existing] = await db.select().from(dailySets).where(eq(dailySets.date, date)).limit(1);
  if (existing) return existing.questionIds;

  const recent = await db.select({ ids: dailySets.questionIds }).from(dailySets).orderBy(desc(dailySets.date)).limit(30);
  const used = recent.flatMap((r) => r.ids);
  const picked: string[] = [];
  for (const difficulty of [1, 2, 3, 3, 4]) {
    const exclude = [...used, ...picked];
    let [q] = await randomPublished(1, [eq(questions.difficulty, difficulty), exclude.length ? notInArray(questions.id, exclude) : undefined]);
    if (!q) [q] = await randomPublished(1, [picked.length ? notInArray(questions.id, picked) : undefined]);
    if (q) picked.push(q.id);
  }
  if (picked.length === 0) throw new QuizError("아직 공개된 문제가 없습니다");

  await db.insert(dailySets).values({ date, questionIds: picked }).onConflictDoNothing();
  const [row] = await db.select().from(dailySets).where(eq(dailySets.date, date)).limit(1);
  return row.questionIds;
}

/** Fight IQ 테스트: 난이도를 고르게 섞고 종목이 한쪽으로 몰리지 않게 */
async function pickTestQuestions(seen: string[]) {
  const plan: Record<number, number> = { 1: 3, 2: 5, 3: 6, 4: 4, 5: 2 };
  const picked: { id: string; difficulty: number; sport: string }[] = [];
  for (const [difficulty, count] of Object.entries(plan)) {
    const rows = await pickFresh(count, seen, [
      eq(questions.difficulty, Number(difficulty)),
      picked.length ? notInArray(questions.id, picked.map((p) => p.id)) : undefined,
    ]);
    picked.push(...rows);
  }
  if (picked.length < MODE_SIZES.test) {
    const rest = await pickFresh(MODE_SIZES.test - picked.length, seen, [
      picked.length ? notInArray(questions.id, picked.map((p) => p.id)) : undefined,
    ]);
    picked.push(...rest);
  }
  return picked.sort((a, b) => a.difficulty - b.difficulty).map((p) => p.id);
}

// --- 시도 시작 -----------------------------------------------------------------------

export type SparringFilters = { sport?: Sport; difficulty?: number };

export async function findTodayDailyAttempt(player: Player) {
  const owner = playerFilter(player);
  if (!owner) return null;
  const [row] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.mode, "daily"), eq(attempts.dailyDate, todayKst()), owner))
    .orderBy(desc(attempts.startedAt))
    .limit(1);
  return row ?? null;
}

export async function startAttempt(player: Player, mode: QuizMode, filters: SparringFilters = {}) {
  if (!player.user && !player.anonId) throw new QuizError("쿠키를 사용할 수 없어 기록을 남길 수 없습니다");

  let questionIds: string[];
  let dailyDate: string | null = null;
  if (mode === "daily") {
    const existing = await findTodayDailyAttempt(player);
    if (existing) return existing.id;
    dailyDate = todayKst();
    questionIds = await getOrCreateDailySet(dailyDate);
  } else {
    const seen = await recentlySeen(player);
    if (mode === "test") {
      questionIds = await pickTestQuestions(seen);
    } else {
      const where = [
        filters.sport ? eq(questions.sport, filters.sport) : undefined,
        filters.difficulty ? eq(questions.difficulty, filters.difficulty) : undefined,
      ];
      questionIds = (await pickFresh(MODE_SIZES.sparring, seen, where)).map((q) => q.id);
    }
  }
  if (questionIds.length === 0) throw new QuizError("조건에 맞는 문제가 아직 없습니다. 조건을 바꿔 보세요.");

  const [attempt] = await db
    .insert(attempts)
    .values({
      userId: player.user?.id ?? null,
      anonId: player.anonId,
      mode,
      dailyDate,
      filters,
      questionIds,
      result: player.user ? { correct: 0, total: questionIds.length, ratingBefore: player.user.rating } : null,
    })
    .returning({ id: attempts.id });
  return attempt.id;
}

// --- 시도 불러오기 --------------------------------------------------------------------

export async function loadAttempt(attemptId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return null;
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
  if (!attempt) return null;
  const qs = await db.select().from(questions).where(inArray(questions.id, attempt.questionIds));
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ordered = attempt.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q);
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attempt.id));
  return { attempt, questions: ordered, answers };
}

export type AnswerFeedback = {
  questionId: string;
  choiceId: string;
  correct: boolean;
  answerChoiceId: string;
  explanation: string;
  sources: Source[];
};

export function feedbackFor(q: Question, choiceId: string): AnswerFeedback {
  return {
    questionId: q.id,
    choiceId,
    correct: choiceId === q.answerChoiceId,
    answerChoiceId: q.answerChoiceId,
    explanation: q.content.ko.explanation,
    sources: q.sources,
  };
}

// --- 답 제출 ---------------------------------------------------------------------------

export async function submitAnswer(
  player: Player,
  attemptId: string,
  questionId: string,
  choiceId: string,
  elapsedMs: number | null,
): Promise<{ feedback: AnswerFeedback; finished: boolean }> {
  return db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(attempts).where(eq(attempts.id, attemptId)).for("update").limit(1);
    if (!attempt) throw new QuizError("풀이 기록을 찾을 수 없습니다");
    const own = (player.user && attempt.userId === player.user.id) || (player.anonId && attempt.anonId === player.anonId);
    if (!own) throw new QuizError("다른 사람의 풀이입니다");
    if (attempt.finishedAt) throw new QuizError("이미 끝난 풀이입니다");
    if (!attempt.questionIds.includes(questionId)) throw new QuizError("이 풀이에 없는 문제입니다");

    const [q] = await tx.select().from(questions).where(eq(questions.id, questionId)).limit(1);
    if (!q) throw new QuizError("문제를 찾을 수 없습니다");
    if (!q.content.ko.choices.some((c) => c.id === choiceId)) throw new QuizError("없는 보기입니다");

    const existing = await tx.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
    const already = existing.find((a) => a.questionId === questionId);
    if (already) return { feedback: feedbackFor(q, already.choiceId), finished: false };

    const correct = choiceId === q.answerChoiceId;
    await tx.insert(attemptAnswers).values({
      attemptId,
      questionId,
      questionVersion: q.version,
      choiceId,
      correct,
      elapsedMs: elapsedMs && elapsedMs > 0 ? Math.min(elapsedMs, 3_600_000) : null,
    });

    // 레이팅: 회원일 때만 사용자 레이팅을 바꾸고, 문제 레이팅은 누가 풀든 보정한다
    let userRating = player.user ? (await tx.select({ r: users.rating }).from(users).where(eq(users.id, player.user.id)))[0]?.r : undefined;
    const next = updateRatings(userRating ?? 1000, q.rating, correct);
    await tx
      .update(questions)
      .set({
        rating: next.question,
        timesAnswered: sql`${questions.timesAnswered} + 1`,
        timesCorrect: sql`${questions.timesCorrect} + ${correct ? 1 : 0}`,
      })
      .where(eq(questions.id, q.id));
    if (player.user && userRating !== undefined && attempt.userId === player.user.id) {
      userRating = next.user;
      await tx.update(users).set({ rating: userRating }).where(eq(users.id, player.user.id));
    }

    const answered = existing.length + 1;
    const finished = answered >= attempt.questionIds.length;
    if (finished) {
      const all = [...existing.map((a) => ({ questionId: a.questionId, correct: a.correct })), { questionId, correct }];
      const result = await buildResult(tx, attempt, all, userRating);
      await tx.update(attempts).set({ finishedAt: new Date(), result }).where(eq(attempts.id, attemptId));
    }
    return { feedback: feedbackFor(q, choiceId), finished };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function buildResult(
  tx: Tx,
  attempt: Attempt,
  answers: { questionId: string; correct: boolean }[],
  ratingAfter: number | undefined,
): Promise<AttemptResult> {
  const qs = await tx
    .select({ id: questions.id, sport: questions.sport, difficulty: questions.difficulty })
    .from(questions)
    .where(inArray(questions.id, attempt.questionIds));
  const meta = new Map(qs.map((q) => [q.id, q]));
  const bySport: Record<string, { correct: number; total: number }> = {};
  for (const a of answers) {
    const sport = meta.get(a.questionId)?.sport ?? "general";
    bySport[sport] ??= { correct: 0, total: 0 };
    bySport[sport].total += 1;
    if (a.correct) bySport[sport].correct += 1;
  }
  const result: AttemptResult = {
    correct: answers.filter((a) => a.correct).length,
    total: attempt.questionIds.length,
    bySport,
    ratingBefore: attempt.result?.ratingBefore,
    ratingAfter,
  };
  if (attempt.mode === "test") {
    result.iq = fightIq(answers.map((a) => ({ difficulty: meta.get(a.questionId)?.difficulty ?? 3, correct: a.correct })));
    const best = Object.entries(bySport)
      .filter(([, s]) => s.total >= 2)
      .sort(([, a], [, b]) => b.correct / b.total - a.correct / a.total || b.total - a.total)[0];
    // 가장 잘한 종목도 절반을 못 넘기면 유형 대신 성장형 칭호
    result.archetype =
      best && best[1].correct / best[1].total >= 0.5
        ? (SPORT_ARCHETYPES[best[0] as Sport] ?? SPORT_ARCHETYPES.general)
        : "성장 중인 루키";
  }
  return result;
}

export { beltForIq };

// --- 문제 넣기 (관리자 가져오기·시드·생성 워커 공용) -------------------------------------

export async function insertQuestions(inputs: QuestionInput[]) {
  let inserted = 0;
  let duplicates = 0;
  for (const q of inputs) {
    const rows = await db
      .insert(questions)
      .values({
        type: q.type,
        sport: q.sport,
        topics: q.topics,
        difficulty: q.difficulty,
        temporal: q.temporal,
        region: q.region,
        answerChoiceId: q.answer.choice_id,
        content: q.content,
        sources: q.sources,
        provenance: q.provenance,
        status: q.status,
        fingerprint: questionFingerprint(q),
        rating: initialQuestionRating(q.difficulty),
        publishedAt: q.status === "published" ? new Date() : null,
      })
      .onConflictDoNothing({ target: questions.fingerprint })
      .returning({ id: questions.id });
    if (rows.length) inserted++;
    else duplicates++;
  }
  return { inserted, duplicates };
}

export function isSport(value: unknown): value is Sport {
  return typeof value === "string" && (SPORTS as readonly string[]).includes(value);
}
