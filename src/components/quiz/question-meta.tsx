import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_LABELS, SPORT_LABELS, type Difficulty, type Sport } from "@/lib/quiz/taxonomy";

export function DifficultyPips({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`난이도 ${level} (${DIFFICULTY_LABELS[level as Difficulty] ?? ""})`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= level ? "size-1.5 rounded-full bg-primary" : "size-1.5 rounded-full bg-muted-foreground/30"} />
      ))}
    </span>
  );
}

export function QuestionMeta({ sport, difficulty, asOf }: { sport: Sport; difficulty: number; asOf?: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="secondary">{SPORT_LABELS[sport] ?? sport}</Badge>
      <DifficultyPips level={difficulty} />
      <span>{DIFFICULTY_LABELS[difficulty as Difficulty]}</span>
      {asOf && <span>· {asOf} 기준</span>}
    </div>
  );
}
