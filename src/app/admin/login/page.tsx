import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPasswordEnabled, isAdminRequest } from "@/lib/admin";

export const metadata: Metadata = { title: "관리자 로그인", robots: { index: false } };

export default async function AdminLoginPage() {
  if (!adminPasswordEnabled()) notFound();
  if (await isAdminRequest()) redirect("/admin");
  return (
    <PageShell narrow className="flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="display-title text-2xl">관리자</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminLoginForm />
        </CardContent>
      </Card>
    </PageShell>
  );
}
