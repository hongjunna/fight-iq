"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { adminLogin, type AdminLoginState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(adminLogin, {});
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        들어가기
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
