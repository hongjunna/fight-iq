"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOutIcon, ShieldCheckIcon, TrophyIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { name: string | null; email: string; avatarUrl: string | null; admin?: boolean };

export function UserMenu({ name, email, avatarUrl, admin = false }: Props) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="계정 메뉴">
        <Avatar>
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback>{(name ?? email).slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="truncate text-sm font-medium text-foreground">{name ?? "로그인됨"}</div>
            <div className="truncate text-xs font-normal">{email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/me" />}>
          <TrophyIcon /> 내 기록
        </DropdownMenuItem>
        {admin && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheckIcon /> 관리자
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={signOut}>
          <LogOutIcon /> 로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
