import { cn } from "@/lib/utils";
import type { BeltId } from "@/lib/quiz/rating";

const BELT_CLASS: Record<BeltId, string> = {
  white: "bg-belt-white text-neutral-900 ring-1 ring-neutral-300",
  blue: "bg-belt-blue text-white",
  purple: "bg-belt-purple text-white",
  brown: "bg-belt-brown text-white",
  black: "bg-belt-black text-white ring-1 ring-white/20",
};

/** 주짓수 벨트 모양 등급 배지 — 끝에 단(스트라이프) 표시 */
export function BeltBadge({ belt, label, size = "md", className }: { belt: BeltId; label: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center overflow-hidden rounded-sm font-semibold",
        size === "sm" && "h-6 text-xs",
        size === "md" && "h-8 text-sm",
        size === "lg" && "h-11 text-base",
        BELT_CLASS[belt],
        className,
      )}
    >
      <span className="px-3">{label}</span>
      <span className={cn("h-full w-6", belt === "black" ? "bg-primary" : "bg-belt-black")} aria-hidden="true">
        <span className="mx-auto block h-full w-1 bg-white/80" />
      </span>
    </span>
  );
}
