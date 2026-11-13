"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, signOut } from "firebase/auth";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { firebaseAuth, googleProvider } from "@/lib/firebase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

export function GoogleSignInButton({ next = "/me" }: { next?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setPending(true);
    const auth = firebaseAuth();
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: await user.getIdToken() }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "로그인하지 못했습니다");
      router.replace(next);
      router.refresh();
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        toast.error(error instanceof Error ? error.message : "로그인하지 못했습니다");
      }
      setPending(false);
    } finally {
      // 서버 세션이 기준이므로 브라우저 쪽 Firebase 세션은 바로 지운다.
      await signOut(auth).catch(() => {});
    }
  }

  return (
    <Button size="lg" variant="outline" className="h-12 w-full gap-3 text-[0.95rem]" onClick={handleSignIn} disabled={pending}>
      {pending ? <Loader2Icon className="animate-spin" /> : <GoogleIcon />}
      Google 계정으로 계속하기
    </Button>
  );
}
