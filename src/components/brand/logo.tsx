import { cn } from "@/lib/utils";

/** 옥타곤 마크 + 워드마크 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <path d="M11 2h10l8 8v12l-8 8H11l-8-8V10z" className="fill-primary" />
      <path d="M12.5 7h7l5.5 5.5v7L19.5 25h-7L7 19.5v-7z" fill="none" className="stroke-primary-foreground/35" strokeWidth="1.2" />
      <text x="16" y="20.6" textAnchor="middle" className="fill-primary-foreground" style={{ font: "700 11px var(--font-heading)" }}>
        IQ
      </text>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="display-title text-xl tracking-wide">
        FIGHT <span className="text-primary">IQ</span>
      </span>
    </span>
  );
}
