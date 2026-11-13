"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { startQuiz, type StartState } from "@/app/actions/quiz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 퀴즈 시작 버튼 (모드별 공통). 필터 입력은 children 으로 넣는다. */
export function StartQuizForm({
  mode,
  label,
  children,
  className,
}: {
  mode: "daily" | "sparring" | "test";
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startQuiz, {});
  return (
    <form action={action} className={cn("space-y-4", className)}>
      <input type="hidden" name="mode" value={mode} />
      {children}
      <Button type="submit" size="lg" className="h-12 w-full text-base font-bold" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {label}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
