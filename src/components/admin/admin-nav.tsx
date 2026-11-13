import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "운영 콘솔" },
  { href: "/admin/questions", label: "문제 관리" },
] as const;

export function AdminNav({ current }: { current: (typeof ITEMS)[number]["href"] }) {
  return (
    <nav className="mb-6 flex gap-1 border-b" aria-label="관리자 메뉴">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.href === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
            i.href === current ? "border-primary text-foreground" : "border-transparent",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
