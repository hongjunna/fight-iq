"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { importQuestions, type ImportState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importQuestions, {});
  return (
    <form action={action} className="space-y-3">
      <Textarea name="json" rows={8} className="font-mono text-xs" placeholder='[{"sport":"mma","topics":["rules"],"difficulty":2,"answer":{"choice_id":"a"},"content":{"ko":{"stem":"…","choices":[{"id":"a","text":"…"}],"explanation":"…"}}}]' required />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="status" value="published" /> 바로 게시 (기본: 검수 대기)
        </label>
        <Button type="submit" disabled={pending} className="ml-auto">
          {pending && <Loader2Icon className="animate-spin" />}
          가져오기
        </Button>
      </div>
      {state.message && <p className="text-sm">{state.message}</p>}
      {state.errors && state.errors.length > 0 && (
        <ul className="space-y-1 text-xs text-destructive">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
