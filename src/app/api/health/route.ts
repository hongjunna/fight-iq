import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", version: process.env.DEPLOYMENT_VERSION ?? "local" });
  } catch {
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
