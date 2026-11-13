import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { User } from "@/lib/db/schema";

export const ADMIN_COOKIE = "fiq_admin";
export const ADMIN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** 관리자 (1): ADMIN_EMAILS (쉼표 구분) 에 있는 구글 계정 */
export function isAdmin(user: Pick<User, "email"> | null | undefined) {
  if (!user) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

/** 관리자 (2): ADMIN_PASSWORD 로 받은 쿠키 — 로그인(Firebase)을 쓰지 않을 때 */
export function adminPasswordEnabled() {
  return (process.env.ADMIN_PASSWORD ?? "").length >= 8;
}

export function adminCookieValue() {
  return createHash("sha256").update(`fightiq-admin:${process.env.ADMIN_PASSWORD ?? ""}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkAdminPassword(password: string) {
  return adminPasswordEnabled() && safeEqual(password, process.env.ADMIN_PASSWORD ?? "");
}

export async function hasAdminCookie() {
  if (!adminPasswordEnabled()) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!value && safeEqual(value, adminCookieValue());
}

export async function isAdminRequest() {
  return (await hasAdminCookie()) || isAdmin(await getCurrentUser());
}

/** 관리자가 아니면: 비밀번호 방식이 켜져 있으면 관리자 로그인으로, 아니면 페이지가 없는 것처럼 */
export async function requireAdmin() {
  if (await isAdminRequest()) return;
  if (adminPasswordEnabled()) redirect("/admin/login");
  notFound();
}
