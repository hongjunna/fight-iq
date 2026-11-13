import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { DifficultyPips } from "@/components/quiz/question-meta";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { QUESTION_STATUSES, type QuestionStatus } from "@/lib/quiz/schema";
import { SPORT_LABELS, SPORTS, TOPIC_LABELS, TOPICS, type Sport, type Topic } from "@/lib/quiz/taxonomy";
import { cn } from "@/lib/utils";
import { setQuestionStatus } from "../actions";

export const metadata: Metadata = { title: "문제 관리", robots: { index: false } };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const STATUS_LABELS: Record<QuestionStatus, string> = { draft: "초안", review: "검수 대기", published: "게시", retired: "내림" };
const ORIGINS = { seed: "시드", worker: "AI 생성", import: "가져오기" } as const;
const SORTS = { new: "최신순", low: "정답률 낮은 순", played: "많이 푼 순", reports: "신고 많은 순" } as const;

const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export default async function AdminQuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = pick(sp.status, QUESTION_STATUSES);
  const sport = pick(sp.sport, SPORTS);
  const topic = pick(sp.topic, TOPICS);
  const origin = pick(sp.origin, Object.keys(ORIGINS) as (keyof typeof ORIGINS)[]);
  const sort = pick(sp.sort, Object.keys(SORTS) as (keyof typeof SORTS)[]) ?? "new";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: SQL[] = [];
  if (status) where.push(eq(questions.status, status));
  if (sport) where.push(eq(questions.sport, sport));
  if (topic) where.push(sql`${topic} = any(${questions.topics})`);
  if (origin === "import") where.push(sql`coalesce(${questions.provenance}->>'origin', '') not in ('seed', 'worker')`);
  else if (origin) where.push(sql`${questions.provenance}->>'origin' = ${origin}`);
  if (q) where.push(ilike(sql`${questions.content}->'ko'->>'stem'`, `%${q.replace(/[%_\\]/g, "\\$&")}%`));
  const whereSql = where.length ? and(...where) : undefined;

  const reportCount = sql<number>`(select count(*)::int from reports r where r.question_id = ${questions.id} and r.status = 'open')`;
  const orderBy =
    sort === "low"
      ? [sql`case when ${questions.timesAnswered} >= 5 then ${questions.timesCorrect}::float / ${questions.timesAnswered} else 2 end`, desc(questions.timesAnswered)]
      : sort === "played"
        ? [desc(questions.timesAnswered)]
        : sort === "reports"
          ? [desc(reportCount), desc(questions.createdAt)]
          : [desc(questions.createdAt)];

  const [rows, [{ total }], statusCounts] = await Promise.all([
    db
      .select({ q: questions, reports: reportCount })
      .from(questions)
      .where(whereSql)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(questions).where(whereSql),
    db.select({ status: questions.status, n: count() }).from(questions).groupBy(questions.status),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s.n]));

  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, sport, topic, origin, sort, q, page: undefined, ...patch } as Record<string, string | number | undefined>;
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "sort" && v === "new") && !(k === "page" && v === 1)) params.set(k, String(v));
    const s = params.toString();
    return `/admin/questions${s ? `?${s}` : ""}`;
  };

  return (
    <PageShell>
      <PageTitle eyebrow="Admin" title="문제 관리" />
      <AdminNav current="/admin/questions" />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterLink active={!status} href={href({ status: undefined })} label={`전체 ${Object.values(byStatus).reduce((a, b) => a + b, 0)}`} />
        {QUESTION_STATUSES.map((s) => (
          <FilterLink key={s} active={status === s} href={href({ status: s })} label={`${STATUS_LABELS[s]} ${byStatus[s] ?? 0}`} />
        ))}
      </div>

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]" action="/admin/questions">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="문항 검색" className="h-9 rounded-md border bg-background px-3 text-sm" />
        <Select name="sport" value={sport} options={SPORTS.map((s) => [s, SPORT_LABELS[s]])} placeholder="모든 종목" />
        <Select name="topic" value={topic} options={TOPICS.map((t) => [t, TOPIC_LABELS[t]])} placeholder="모든 주제" />
        <Select name="origin" value={origin} options={Object.entries(ORIGINS)} placeholder="모든 출처" />
        <Select name="sort" value={sort} options={Object.entries(SORTS)} />
        <Button type="submit" size="lg">
          적용
        </Button>
      </form>

      <p className="mb-3 text-sm text-muted-foreground">
        {total.toLocaleString()}개 중 {total ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)}
      </p>

      <div className="space-y-2">
        {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">조건에 맞는 문제가 없습니다.</p>}
        {rows.map(({ q: item, reports }) => {
          const ko = item.content.ko;
          const answer = ko.choices.find((c) => c.id === item.answerChoiceId)?.text;
          const acc = item.timesAnswered ? Math.round((item.timesCorrect / item.timesAnswered) * 100) : null;
          const prov = item.provenance as { origin?: string; generator?: string; blind_agree?: string };
          return (
            <Card key={item.id} size="sm">
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={item.status === "published" ? "default" : item.status === "review" ? "secondary" : "outline"}>{STATUS_LABELS[item.status]}</Badge>
                  <span>{SPORT_LABELS[item.sport as Sport] ?? item.sport}</span>
                  <span>· {item.topics.map((t) => TOPIC_LABELS[t as Topic] ?? t).join(", ")}</span>
                  <DifficultyPips level={item.difficulty} />
                  <span>· {ORIGINS[prov.origin as keyof typeof ORIGINS] ?? "가져오기"}{prov.blind_agree ? ` (블라인드 ${prov.blind_agree})` : ""}</span>
                  {item.temporal.kind !== "evergreen" && <span>· {item.temporal.kind === "as_of" ? `${item.temporal.as_of} 기준` : "규칙 개정 주의"}</span>}
                  <span className="ml-auto tabular-nums">
                    {acc === null ? "아직 안 풀림" : `정답률 ${acc}% (${item.timesAnswered}회)`} · v{item.version}
                  </span>
                </div>
                <Link href={`/admin/questions/${item.id}`} className="block font-medium hover:text-primary">
                  {ko.stem}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    정답 <strong className="text-gold">{answer}</strong>
                  </span>
                  {reports > 0 && <Badge variant="destructive">신고 {reports}</Badge>}
                  <div className="ml-auto flex gap-1">
                    {item.status !== "published" && (
                      <form action={setQuestionStatus.bind(null, [item.id], "published")}>
                        <Button size="xs">게시</Button>
                      </form>
                    )}
                    {item.status === "published" && (
                      <form action={setQuestionStatus.bind(null, [item.id], "review")}>
                        <Button size="xs" variant="outline">
                          검수로
                        </Button>
                      </form>
                    )}
                    {item.status !== "retired" && (
                      <form action={setQuestionStatus.bind(null, [item.id], "retired")}>
                        <Button size="xs" variant="ghost">
                          내림
                        </Button>
                      </form>
                    )}
                    <Link href={`/admin/questions/${item.id}`} className={buttonVariants({ size: "xs", variant: "secondary" })}>
                      편집
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          <Link aria-disabled={page <= 1} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")} href={href({ page: page - 1 })}>
            이전
          </Link>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Link aria-disabled={page >= pages} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")} href={href({ page: page + 1 })}>
            다음
          </Link>
        </div>
      )}
    </PageShell>
  );
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn("rounded-full border px-3 py-1.5 text-sm", active ? "border-primary bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
    </Link>
  );
}

function Select({ name, value, options, placeholder }: { name: string; value?: string; options: [string, string][]; placeholder?: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
