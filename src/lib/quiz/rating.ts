/**
 * 사용자와 문제를 둘 다 레이팅을 가진 선수로 보고 Elo 로 갱신한다 (기획서 §8-3).
 * 사용자 레이팅 → Fight IQ 점수·벨트, 문제 레이팅 → 실측 난이도.
 */

export const USER_START_RATING = 1000;
const USER_K = 24;
const QUESTION_K = 8;

/** 난이도 1~5 → 문제의 처음 레이팅 */
export function initialQuestionRating(difficulty: number) {
  return 1000 + (difficulty - 3) * 150;
}

export function expectedScore(userRating: number, questionRating: number) {
  return 1 / (1 + 10 ** ((questionRating - userRating) / 400));
}

export function updateRatings(userRating: number, questionRating: number, correct: boolean) {
  const expected = expectedScore(userRating, questionRating);
  const score = correct ? 1 : 0;
  return {
    user: userRating + USER_K * (score - expected),
    question: questionRating - QUESTION_K * (score - expected),
  };
}

export const BELTS = [
  { id: "white", label: "화이트 벨트", min: -Infinity },
  { id: "blue", label: "블루 벨트", min: 1100 },
  { id: "purple", label: "퍼플 벨트", min: 1250 },
  { id: "brown", label: "브라운 벨트", min: 1400 },
  { id: "black", label: "블랙 벨트", min: 1550 },
] as const;
export type BeltId = (typeof BELTS)[number]["id"];

export function beltForRating(rating: number) {
  return [...BELTS].reverse().find((b) => rating >= b.min) ?? BELTS[0];
}

/** Fight IQ 테스트 점수(70~160) → 벨트 */
export function beltForIq(iq: number) {
  if (iq >= 135) return BELTS[4];
  if (iq >= 120) return BELTS[3];
  if (iq >= 105) return BELTS[2];
  if (iq >= 90) return BELTS[1];
  return BELTS[0];
}

const DIFFICULTY_WEIGHT: Record<number, number> = { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3 };

/** 난이도 가중 정답률 → IQ 70~160 */
export function fightIq(answers: { difficulty: number; correct: boolean }[]) {
  const max = answers.reduce((s, a) => s + (DIFFICULTY_WEIGHT[a.difficulty] ?? 2), 0);
  if (max === 0) return 70;
  const got = answers.reduce((s, a) => s + (a.correct ? (DIFFICULTY_WEIGHT[a.difficulty] ?? 2) : 0), 0);
  return Math.round(70 + (got / max) * 90);
}
