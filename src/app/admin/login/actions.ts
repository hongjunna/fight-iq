"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, adminCookieValue, checkAdminPassword } from "@/lib/admin";

export type AdminLoginState = { error?: string };

export async function adminLogin(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  // 무차별 대입을 늦추기 위해 실패·성공 모두 잠깐 기다린다
  await new Promise((r) => setTimeout(r, 600));
  if (!checkAdminPassword(String(formData.get("password") ?? ""))) return { error: "비밀번호가 맞지 않습니다" };
  (await cookies()).set(ADMIN_COOKIE, adminCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/");
}
