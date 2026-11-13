"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { cancelGenerationRequest, requestGeneration, type GenerateState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export type ManualRun = {
  kind: string;
  startedAt: string;
  finishedAt: string | null;
  stats: Record<string, number>;
} | null;

const STATE_LABEL: Record<string, string> = {
  "manual-pending": "대기 중 — 워커가 곧 가져갑니다",
  "manual-running": "생성 중",
  manual: "완료",
  "manual-interrupted": "중단됨 (워커 재시작 등)",
  "manual-cancelled": "취소됨",
};

/** "지금 문제 생성하기" — 생성 시간대가 아니어도 바로 만든다. 진행 중에는 20초마다 새로 고침 */
export function GenerateNow({ last }: { last: ManualRun }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<GenerateState, FormData>(requestGeneration, {});
  const active = last?.kind === "manual-pending" || last?.kind === "manual-running";

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [active, router]);

  const s = last?.stats ?? {};
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          주제
          <select name="count" defaultValue="6" className="h-8 rounded-md border bg-background px-2 text-sm" disabled={active}>
            {[3, 6, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm" disabled={pending || active}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          지금 문제 생성하기
        </Button>
        {last?.kind === "manual-pending" && (
          <Button type="button" size="sm" variant="ghost" onClick={() => cancelGenerationRequest().then(() => router.refresh())}>
            요청 취소
          </Button>
        )}
      </form>
      <p className="text-xs text-muted-foreground">
        생성 시간대가 아니어도 바로 만듭니다. 주제 1개에 3~7분, 동시에 2개씩 처리하고, 코딩 작업 등으로 브릿지가 바쁘면 기다립니다.
      </p>
      {state.message && <p className="text-sm">{state.message}</p>}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {last && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          {active && <Loader2Icon className="size-4 animate-spin text-primary" />}
          <span className="font-medium">최근 요청: {STATE_LABEL[last.kind] ?? last.kind}</span>
          <span className="text-muted-foreground">
            {new Date(last.startedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
            {s.requested ? ` · 요청 ${s.requested}개` : ""}
            {last.finishedAt ? ` · 게시 ${s.published ?? 0} · 검수 ${s.review ?? 0} · 폐기 ${(s.rejected ?? 0) + (s.error ?? 0)}` : ""}
          </span>
        </p>
      )}
    </div>
  );
}
