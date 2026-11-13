"use client";

import { useState, useTransition } from "react";
import { FlagIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { reportQuestion } from "@/app/actions/quiz";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const REASONS = [
  { id: "wrong_answer", label: "정답이 틀렸어요" },
  { id: "outdated", label: "정보가 오래됐어요" },
  { id: "ambiguous", label: "문제가 애매해요" },
  { id: "other", label: "기타" },
] as const;

export function ReportDialog({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["id"]>("wrong_answer");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await reportQuestion({ questionId, reason, note: note || undefined });
      if (res.ok) {
        toast.success("신고를 받았어요. 확인 후 고칠게요.");
        setOpen(false);
        setNote("");
      } else {
        toast.error(res.error ?? "신고를 보내지 못했습니다");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <FlagIcon /> 문제 신고
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이 문제에 문제가 있나요?</DialogTitle>
          <DialogDescription>신고는 검수에 바로 반영됩니다.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="신고 사유">
          {REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={reason === r.id}
              onClick={() => setReason(r.id)}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-sm",
                reason === r.id ? "border-primary bg-accent" : "border-border hover:bg-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="무엇이 틀렸는지 알려 주시면 더 빨리 고칠 수 있어요 (선택)" maxLength={1000} />
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            신고하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
