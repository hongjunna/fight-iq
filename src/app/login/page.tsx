import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LogoMark } from "@/components/brand/logo";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { FIREBASE_ENABLED } from "@/lib/features";

export const metadata: Metadata = { title: "로그인", robots: { index: false } };

function safeNext(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/me";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (!FIREBASE_ENABLED) redirect("/me");
  if (await getCurrentUser()) redirect(next);

  return (
    <PageShell narrow className="flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <LogoMark className="mx-auto mb-2 size-12" />
          <CardTitle className="display-title text-2xl">링에 오르기</CardTitle>
          <CardDescription>로그인하면 기록이 저장되고 레이팅과 벨트를 받을 수 있어요. 지금까지 이 브라우저에서 푼 기록도 함께 옮겨집니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleSignInButton next={next} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
