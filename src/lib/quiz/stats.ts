import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, questions } from "@/lib/db/schema";
import { todayKst } from "./dates";

export async function publishedCountsBySport() {
  const rows = await db
    .select({ sport: questions.sport, n: count() })
    .from(questions)
    .where(eq(questions.status, "published"))
    .groupBy(questions.sport);
  return Object.fromEntries(rows.map((r) => [r.sport, r.n])) as Record<string, number>;
}

/** 오늘의 5라운드 참여자 수·평균 점수 */
export async function dailyStats(date = todayKst()) {
  const [row] = await db
    .select({
      players: count(),
      avg: sql<number | null>`avg((${attempts.result}->>'correct')::int)`,
    })
    .from(attempts)
    .where(and(eq(attempts.mode, "daily"), eq(attempts.dailyDate, date), sql`${attempts.finishedAt} is not null`));
  return { players: row?.players ?? 0, avg: row?.avg != null ? Number(row.avg) : null };
}
