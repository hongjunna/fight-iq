// 워커 전용 DB 연결 (웹 앱의 lib/db 는 server-only 라 Next 밖에서 쓸 수 없다)
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { config } from "./config";

export const sql = postgres(config.databaseUrl, { max: 4 });
export const db = drizzle({ client: sql, schema });
