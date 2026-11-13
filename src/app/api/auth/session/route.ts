import { NextResponse } from "next/server";
import { z } from "zod";
import { FIREBASE_ENABLED } from "@/lib/features";
import { claimAnonymousAttempts, createSession, destroySession, upsertUser, verifyFirebaseIdToken } from "@/lib/auth";

const bodySchema = z.object({ idToken: z.string().min(1) });

export async function POST(request: Request) {
  if (!FIREBASE_ENABLED) return NextResponse.json({ error: "로그인 기능이 꺼져 있습니다" }, { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "로그인 토큰이 없습니다" }, { status: 400 });

  try {
    const identity = await verifyFirebaseIdToken(parsed.data.idToken);
    const user = await upsertUser(identity);
    await createSession(user.id);
    await claimAnonymousAttempts(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth] sign-in failed", error);
    return NextResponse.json({ error: "로그인을 확인하지 못했습니다" }, { status: 401 });
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
