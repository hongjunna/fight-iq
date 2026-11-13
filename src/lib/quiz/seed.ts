import { count } from "drizzle-orm";
import { SEED_QUESTIONS } from "@/data/seed-questions";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { insertQuestions } from "./engine";

/** 문제은행이 완전히 비어 있을 때만 시드 문제를 넣는다 */
export async function seedIfEmpty() {
  const [{ n }] = await db.select({ n: count() }).from(questions);
  if (n > 0) return;
  const { inserted } = await insertQuestions(SEED_QUESTIONS);
  console.log(`[seed] inserted ${inserted} seed questions`);
}
