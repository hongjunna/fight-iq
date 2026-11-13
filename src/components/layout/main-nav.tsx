"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/daily", label: "오늘의 5라운드", short: "5라운드" },
  { href: "/sparring", label: "스파링", short: "스파링" },
  { href: "/test", label: "Fight IQ 테스트", short: "IQ 테스트" },
  { href: "/me", label: "내 기록", short: "내 기록" },
] as const;

export function MainNav({ className, mobile = false }: { className?: string; mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={cn("items-center gap-1", className)} aria-label="주요 메뉴">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              mobile && "flex-1 rounded-none border-b-2 border-transparent px-1 text-center",
              active && "text-foreground",
              active && mobile && "border-primary",
              active && !mobile && "bg-muted",
            )}
          >
            {mobile ? item.short : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
