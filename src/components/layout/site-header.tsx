import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { hasAdminCookie, isAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { FIREBASE_ENABLED } from "@/lib/features";
import { MainNav } from "./main-nav";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const [user, adminByPassword] = await Promise.all([getCurrentUser(), hasAdminCookie()]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" aria-label="Fight IQ 홈">
          <Logo />
        </Link>
        <MainNav className="ml-4 hidden md:flex" />
        <div className="ml-auto flex items-center gap-1">
          {adminByPassword && !isAdmin(user) && (
            <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="관리자">
              <ShieldCheckIcon />
            </Link>
          )}
          <ThemeToggle />
          {user ? (
            <UserMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} admin={isAdmin(user)} />
          ) : (
            FIREBASE_ENABLED && (
              <Link href="/login" className={buttonVariants({ size: "lg" })}>
                로그인
              </Link>
            )
          )}
        </div>
      </div>
      <MainNav className="flex border-t px-2 md:hidden" mobile />
    </header>
  );
}
