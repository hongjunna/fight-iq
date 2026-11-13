import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { attempts, sessions, users, type User } from "@/lib/db/schema";
import { ANON_COOKIE } from "@/lib/player-cookie";

export const SESSION_COOKIE = "fiq_session";
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type FirebaseIdentity = {
  uid: string;
  email: string;
  name: string | null;
  picture: string | null;
};

/** Firebase Auth ID 토큰을 구글 공개키로 검증한다 (서비스 계정 불필요). */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set");

  const { payload } = await jwtVerify(idToken, firebaseJwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (!payload.sub || typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new Error("Token is missing a verified email");
  }
  return {
    uid: payload.sub,
    email: payload.email.toLowerCase(),
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function upsertUser(identity: FirebaseIdentity): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({ firebaseUid: identity.uid, email: identity.email, name: identity.name, avatarUrl: identity.picture })
    .onConflictDoUpdate({
      target: users.firebaseUid,
      set: { email: identity.email, name: identity.name, avatarUrl: identity.picture, lastLoginAt: new Date() },
    })
    .returning();
  return user;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** 비회원으로 푼 기록을 로그인한 계정으로 옮긴다 */
export async function claimAnonymousAttempts(userId: string) {
  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  if (!anonId) return;
  await db
    .update(attempts)
    .set({ userId })
    .where(and(eq(attempts.anonId, anonId), isNull(attempts.userId)));
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row?.user ?? null;
});

export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}
