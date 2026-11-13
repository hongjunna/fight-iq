/**
 * 무엇을 만들지 정한다 (기획서 §6-3 ①).
 * 종목×주제 칸마다 문제 수를 세서 부족한 칸을 고르고, 모델에게 그 칸의 구체적인 출제 주제를 받는다.
 * 이미 있는 문제·최근 시도한 주제는 피하게 한다.
 */
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { generationItems, questions } from "@/lib/db/schema";
import type { Sport, Topic } from "@/lib/quiz/taxonomy";
import { db } from "./db";
import { chatJson, type CallTrace } from "./llm";
import type { Risk, Subject } from "./pipeline";

export const PLAN_CELLS: Record<Sport, Topic[]> = {
  mma: ["rules", "technique", "history", "people", "events", "orgs", "records", "korea"],
  boxing: ["rules", "technique", "history", "people", "events", "orgs", "records", "korea"],
  kickboxing: ["rules", "technique", "history", "people", "events", "orgs"],
  bjj: ["rules", "technique", "history", "people", "events", "orgs"],
  wrestling: ["rules", "technique", "history", "people", "events"],
  judo_sambo: ["rules", "technique", "history", "people"],
  general: ["culture", "technique", "rules"],
};

const DEFAULT_RISK: Record<Topic, Risk> = {
  technique: "low",
  culture: "low",
  rules: "normal",
  history: "normal",
  orgs: "normal",
  people: "high",
  records: "high",
  events: "high",
  korea: "high",
};

const DIFFICULTY_ROTATION = [1, 2, 2, 3, 3, 3, 4, 4, 5];

const PLAN_SYS = `You plan questions for 'Fight IQ', a Korean combat-sports quiz (MMA, boxing, kickboxing/Muay Thai, BJJ/grappling, wrestling, judo/sambo).
For each [CELL], propose ONE specific, well-documented subject that combat-sports fans would find interesting.
Rules:
- The subject must be verifiable on Wikipedia, official federation sites, or major sports media.
- Prefer settled facts (history, rules principles, techniques, famous fights, career milestones of retired or long-established athletes).
- Avoid current champions, current rankings, ongoing streaks, rumors, betting, injuries, personal life.
- Do NOT repeat any subject listed under "avoid".
- topic "korea" means Korean fighters, Korean promotions (e.g. ROAD FC) or Korean milestones.
- brief: one English sentence naming exactly what fact cluster to ask about.
- queries: 2 English web-search queries (for "korea" you may add a Korean query as a third).
- versioned: true if the answer depends on rules/records that have changed or may change.
Output JSON only: {"subjects":[{"cell":1,"brief":"...","queries":["...","..."],"versioned":false}]}`;

export async function planSubjects(count: number, calls: CallTrace[]): Promise<Subject[]> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [counts, recentRejected] = await Promise.all([
    db
      .select({ sport: questions.sport, topic: sql<string>`unnest(${questions.topics})`, n: sql<number>`count(*)::int` })
      .from(questions)
      .where(inArray(questions.status, ["published", "review"]))
      .groupBy(questions.sport, sql`unnest(${questions.topics})`),
    db
      .select({ sport: generationItems.sport, topic: generationItems.topic, n: sql<number>`count(*)::int` })
      .from(generationItems)
      .where(and(gte(generationItems.createdAt, since), inArray(generationItems.verdict, ["rejected", "error"])))
      .groupBy(generationItems.sport, generationItems.topic),
  ]);
  const key = (s: string, t: string) => `${s}/${t}`;
  const have = new Map(counts.map((c) => [key(c.sport, c.topic), c.n]));
  const failed = new Map(recentRejected.map((c) => [key(c.sport, c.topic), c.n]));

  // 문제가 적은 칸부터 (최근 실패가 잦은 칸은 조금 뒤로), 동점은 무작위
  const cells = Object.entries(PLAN_CELLS)
    .flatMap(([sport, topics]) => topics.map((topic) => ({ sport: sport as Sport, topic })))
    .map((c) => ({ ...c, score: (have.get(key(c.sport, c.topic)) ?? 0) + 0.5 * (failed.get(key(c.sport, c.topic)) ?? 0) + Math.random() * 0.9 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count);
  if (cells.length === 0) return [];

  const avoidBlocks = await Promise.all(
    cells.map(async (c) => {
      const [recentBriefs, stems] = await Promise.all([
        db
          .select({ brief: generationItems.brief })
          .from(generationItems)
          .where(and(eq(generationItems.sport, c.sport), eq(generationItems.topic, c.topic)))
          .orderBy(desc(generationItems.createdAt))
          .limit(30),
        db
          .select({ content: questions.content })
          .from(questions)
          .where(and(eq(questions.sport, c.sport), sql`${c.topic} = any(${questions.topics})`))
          .orderBy(desc(questions.createdAt))
          .limit(30),
      ]);
      return [...recentBriefs.map((r) => r.brief), ...stems.map((s) => s.content.ko.stem)];
    }),
  );

  const userMsg = cells
    .map((c, i) => `[CELL ${i + 1}] sport=${c.sport} topic=${c.topic}\navoid:\n${avoidBlocks[i].map((a) => `- ${a}`).join("\n") || "- (none yet)"}`)
    .join("\n\n");
  const res = await chatJson<{ subjects?: { cell?: number; brief?: string; queries?: string[]; versioned?: boolean }[] }>(
    ["super", "ultra"],
    [{ role: "system", content: PLAN_SYS }, { role: "user", content: userMsg }],
    calls,
    { maxTokens: 6000, temperature: 0.9 },
  );

  const out: Subject[] = [];
  for (const s of res?.data.subjects ?? []) {
    const c = cells[(s.cell ?? 0) - 1];
    if (!c || !s.brief || !s.queries?.length) continue;
    out.push({
      sport: c.sport,
      topic: c.topic,
      difficulty: DIFFICULTY_ROTATION[Math.floor(Math.random() * DIFFICULTY_ROTATION.length)],
      brief: s.brief.slice(0, 400),
      queries: s.queries.slice(0, 3).map((q) => q.slice(0, 200)),
      risk: DEFAULT_RISK[c.topic],
      versioned: !!s.versioned,
    });
  }
  return out;
}
