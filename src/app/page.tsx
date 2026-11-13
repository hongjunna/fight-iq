import Link from "next/link";
import { ArrowRightIcon, BrainIcon, DumbbellIcon, SwordsIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlayer } from "@/lib/player";
import { formatKoreanDate, todayKst } from "@/lib/quiz/dates";
import { findTodayDailyAttempt } from "@/lib/quiz/engine";
import { dailyStats, publishedCountsBySport } from "@/lib/quiz/stats";
import { SPORT_LABELS, SPORTS } from "@/lib/quiz/taxonomy";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MODES = [
  {
    href: "/sparring",
    icon: DumbbellIcon,
    title: "스파링",
    desc: "종목과 난이도를 골라 10문제씩. 점수 부담 없이 연습하세요.",
  },
  {
    href: "/test",
    icon: BrainIcon,
    title: "Fight IQ 테스트",
    desc: "20문제로 종목별 강점과 약점을 진단하고 내 Fight IQ를 확인하세요.",
  },
] as const;

export default async function HomePage() {
  const [player, counts, today] = await Promise.all([getPlayer(), publishedCountsBySport(), dailyStats()]);
  const daily = await findTodayDailyAttempt(player);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <main className="flex-1">
      <section className="spotlight border-b">
        <div className="mx-auto max-w-5xl px-4 pt-12 pb-10 sm:pt-20 sm:pb-16">
          <p className="mb-4 text-xs font-semibold tracking-[0.3em] text-primary uppercase">MMA · 복싱 · 킥복싱 · 주짓수 · 레슬링</p>
          <h1 className="display-title text-5xl sm:text-7xl">
            풀수록 쌓이는
            <br />
            <span className="text-primary">격투 지식</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            매일 5문제, 문제마다 해설까지. 링 밖에서 겨루는 격투 팬들의 두뇌 싸움, Fight IQ.
          </p>

          <Card className="mt-8 max-w-xl border-2 border-primary/40 bg-card/80 backdrop-blur">
            <CardHeader>
              <p className="text-xs font-semibold tracking-widest text-primary uppercase">{formatKoreanDate(todayKst())}</p>
              <CardTitle className="display-title text-3xl">
                <SwordsIcon className="mr-2 inline size-7 align-[-4px] text-primary" />
                오늘의 5라운드
              </CardTitle>
              <CardDescription>
                전원에게 같은 5문제. 난이도는 라운드마다 올라갑니다.
                {today.players > 0 && (
                  <>
                    {" "}오늘 {today.players.toLocaleString()}명 참여 · 평균 {today.avg?.toFixed(1)}점
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {daily?.finishedAt ? (
                <Link href={`/result/${daily.id}`} className={buttonVariants({ size: "lg", variant: "secondary", className: "h-12 w-full text-base font-bold" })}>
                  오늘 결과 보기 · {daily.result?.correct}/{daily.result?.total}
                </Link>
              ) : (
                <Link href="/daily" className={buttonVariants({ size: "lg", className: "h-12 w-full text-base font-bold" })}>
                  {daily ? "이어서 풀기" : "공 울리기 — 시작"} <ArrowRightIcon />
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-10 sm:grid-cols-2">
        {MODES.map((m) => (
          <Link key={m.href} href={m.href} className="group">
            <Card className="h-full transition-colors group-hover:ring-primary/50">
              <CardHeader>
                <m.icon className="mb-2 size-7 text-primary" />
                <CardTitle className="display-title text-2xl">{m.title}</CardTitle>
                <CardDescription className="text-base">{m.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  시작하기 <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-14">
        <h2 className="display-title mb-4 text-2xl">문제은행</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          검증을 통과한 문제 {total.toLocaleString()}개. 새 문제가 매일 추가됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <Link
              key={s}
              href={`/sparring?sport=${s}`}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors hover:border-primary hover:text-foreground",
                counts[s] ? "text-foreground" : "pointer-events-none text-muted-foreground opacity-60",
              )}
            >
              {SPORT_LABELS[s]} <span className="ml-1 text-muted-foreground tabular-nums">{counts[s] ?? 0}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
