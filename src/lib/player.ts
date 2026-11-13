import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import type { Attempt, User } from "@/lib/db/schema";
import { ANON_COOKIE } from "@/lib/player-cookie";

/** 지금 푸는 사람: 로그인한 회원 또는 비회원 쿠키 */
export type Player = { user: User | null; anonId: string | null };

export async function getPlayer(): Promise<Player> {
  const [user, store] = await Promise.all([getCurrentUser(), cookies()]);
  return { user, anonId: store.get(ANON_COOKIE)?.value ?? null };
}

export function ownsAttempt(player: Player, attempt: Pick<Attempt, "userId" | "anonId">) {
  if (player.user && attempt.userId === player.user.id) return true;
  return !!player.anonId && attempt.anonId === player.anonId;
}
