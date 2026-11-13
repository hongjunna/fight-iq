import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function migrateOnce(url: string) {
  const sql = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    await migrate(drizzle({ client: sql }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Applies pending migrations before the server accepts requests. If the database
 * isn't reachable yet, keep retrying with backoff instead of crashing, so the
 * process never needs a restart.
 */
export async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL is not set; skipping migrations");
    return;
  }

  for (let attempt = 1; ; attempt++) {
    try {
      await migrateOnce(url);
      console.log("[db] migrations applied");
      return;
    } catch (error) {
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt - 1, 5));
      console.error(`[db] migration attempt ${attempt} failed; retrying in ${delay / 1000}s`, error);
      await sleep(delay);
    }
  }
}
