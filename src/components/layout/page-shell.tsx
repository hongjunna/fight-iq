import { cn } from "@/lib/utils";

/** 모든 페이지 공통 본문 틀 */
export function PageShell({ children, className, narrow = false }: { children: React.ReactNode; className?: string; narrow?: boolean }) {
  return <main className={cn("mx-auto w-full flex-1 px-4 py-6 sm:py-10", narrow ? "max-w-2xl" : "max-w-5xl", className)}>{children}</main>;
}

export function PageTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-2">
      {eyebrow && <p className="text-xs font-semibold tracking-widest text-primary uppercase">{eyebrow}</p>}
      <h1 className="display-title text-3xl sm:text-4xl">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  );
}
