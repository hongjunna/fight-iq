import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 프로세스당 풀 하나. 운영에서는 이 모듈이 여러 번들(라우트, instrumentation)에서 불리고
// 개발 중에는 변경 때마다 다시 불리므로 전역에 둔다. postgres.js 는 첫 쿼리 때 연결한다.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };
const pgClient = (globalForDb.pgClient ??= postgres(process.env.DATABASE_URL ?? "", {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
}));

export const db = drizzle({ client: pgClient, schema });
