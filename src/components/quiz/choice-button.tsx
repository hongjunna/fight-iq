import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChoiceState = "idle" | "selected" | "correct" | "wrong" | "dimmed";

/** 큰 보기 버튼 — 한 손 엄지로 누르기 좋게 */
export function ChoiceButton({
  index,
  text,
  state,
  disabled,
  onClick,
}: {
  index: number;
  text: string;
  state: ChoiceState;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state === "selected"}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-xl border-2 bg-card px-4 py-3 text-left text-base font-medium transition-all",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        state === "idle" && "hover:border-primary/60 hover:bg-accent active:scale-[0.99]",
        state === "selected" && "border-primary bg-accent",
        state === "correct" && "border-gold bg-gold/15",
        state === "wrong" && "border-primary bg-primary/10",
        state === "dimmed" && "opacity-50",
        disabled && "cursor-default",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-heading text-sm",
          state === "correct" && "bg-gold text-gold-foreground",
          state === "wrong" && "bg-primary text-primary-foreground",
        )}
        aria-hidden="true"
      >
        {state === "correct" ? <CheckIcon className="size-4" /> : state === "wrong" ? <XIcon className="size-4" /> : String.fromCharCode(65 + index)}
      </span>
      <span className="flex-1">{text}</span>
    </button>
  );
}
