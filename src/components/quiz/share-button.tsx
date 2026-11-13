"use client";

import { Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** 모바일은 공유 시트, 데스크톱은 클립보드 복사 */
export function ShareButton({ text, url, label = "결과 공유하기" }: { text: string; url: string; label?: string }) {
  async function share() {
    const full = new URL(url, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ text, url: full });
        return;
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${full}`);
      toast.success("결과를 복사했어요. 원하는 곳에 붙여 넣으세요.");
    } catch {
      toast.error("복사하지 못했습니다");
    }
  }
  return (
    <Button size="lg" className="h-12 w-full text-base font-bold" onClick={share}>
      <Share2Icon /> {label}
    </Button>
  );
}
