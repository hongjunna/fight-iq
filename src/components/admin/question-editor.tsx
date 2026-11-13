"use client";

import { useActionState, useState } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import type { EditState } from "@/app/admin/questions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DIFFICULTY_LABELS, SPORT_LABELS, SPORTS, TOPIC_LABELS, TOPICS, type Difficulty } from "@/lib/quiz/taxonomy";
import { cn } from "@/lib/utils";

type Initial = {
  stem: string;
  choices: { id: string; text: string }[];
  answer: string;
  explanation: string;
  sport: string;
  topics: string[];
  difficulty: number;
  status: string;
  temporalKind: string;
  asOf: string;
};

const STATUS_OPTIONS = [
  ["published", "게시"],
  ["review", "검수 대기"],
  ["draft", "초안"],
  ["retired", "내림"],
] as const;

export function QuestionEditor({ action, initial }: { action: (prev: EditState, fd: FormData) => Promise<EditState>; initial: Initial }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [answer, setAnswer] = useState(initial.answer);
  const [temporalKind, setTemporalKind] = useState(initial.temporalKind);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="stem">문항</Label>
        <Textarea id="stem" name="stem" defaultValue={initial.stem} rows={3} required />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">보기 (왼쪽 원을 눌러 정답 지정)</legend>
        {initial.choices.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <input type="hidden" name="choiceId" value={c.id} />
            <button
              type="button"
              onClick={() => setAnswer(c.id)}
              aria-pressed={answer === c.id}
              aria-label={`${c.id} 를 정답으로`}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-heading text-sm",
                answer === c.id ? "border-gold bg-gold text-gold-foreground" : "text-muted-foreground hover:border-primary",
              )}
            >
              {answer === c.id ? <CheckIcon className="size-4" /> : c.id}
            </button>
            <Input name="choiceText" defaultValue={c.text} required />
          </div>
        ))}
        <input type="hidden" name="answer" value={answer} />
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="explanation">해설</Label>
        <Textarea id="explanation" name="explanation" defaultValue={initial.explanation} rows={4} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="sport">종목</Label>
          <select id="sport" name="sport" defaultValue={initial.sport} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {SPORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="difficulty">난이도</Label>
          <select id="difficulty" name="difficulty" defaultValue={String(initial.difficulty)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            {([1, 2, 3, 4, 5] as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {d} · {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">상태</Label>
          <select id="status" name="status" defaultValue={initial.status} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            {STATUS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">주제 (1~3개)</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <label key={t} className="cursor-pointer">
              <input type="checkbox" name="topics" value={t} defaultChecked={initial.topics.includes(t)} className="peer sr-only" />
              <span className="inline-flex h-8 items-center rounded-full border-2 px-3 text-sm peer-checked:border-primary peer-checked:bg-accent peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                {TOPIC_LABELS[t]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="temporalKind">시의성</Label>
          <select
            id="temporalKind"
            name="temporalKind"
            value={temporalKind}
            onChange={(e) => setTemporalKind(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="evergreen">변하지 않는 사실</option>
            <option value="as_of">기준 날짜가 있는 사실</option>
            <option value="rule_versioned">규칙 개정 가능</option>
          </select>
        </div>
        {temporalKind === "as_of" && (
          <div className="space-y-1.5">
            <Label htmlFor="asOf">기준 날짜 (문항에도 연도를 적어 주세요)</Label>
            <Input id="asOf" name="asOf" type="date" defaultValue={initial.asOf} required />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          저장
        </Button>
        {state.ok && <span className="text-sm text-success">저장했습니다</span>}
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
      {state.issues && state.issues.length > 0 && (
        <ul className="space-y-1 text-xs text-destructive">
          {state.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
