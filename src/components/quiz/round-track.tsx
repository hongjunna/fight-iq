import { cn } from "@/lib/utils";

export type RoundState = "pending" | "current" | "correct" | "wrong";

/** 라운드 진행 표시 — 5문제 이하는 R1…R5 칩, 그 이상은 얇은 막대 */
export function RoundTrack({ states }: { states: RoundState[] }) {
  const compact = states.length > 5;
  return (
    <ol className={cn("flex w-full", compact ? "gap-1" : "gap-2")} aria-label="진행 상황">
      {states.map((s, i) => (
        <li
          key={i}
          aria-current={s === "current" ? "step" : undefined}
          aria-label={`${i + 1}번 ${s === "correct" ? "정답" : s === "wrong" ? "오답" : s === "current" ? "진행 중" : "대기"}`}
          className={cn(
            "flex flex-1 items-center justify-center rounded-md font-heading transition-colors",
            compact ? "h-1.5" : "h-9 text-sm",
            s === "pending" && "bg-muted text-muted-foreground",
            s === "current" && "bg-foreground text-background",
            s === "correct" && "bg-gold text-gold-foreground",
            s === "wrong" && "bg-primary/25 text-primary",
          )}
        >
          {!compact && `R${i + 1}`}
        </li>
      ))}
    </ol>
  );
}
