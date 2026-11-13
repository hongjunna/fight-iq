import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { StartQuizForm } from "@/components/quiz/start-quiz-form";
import { Card, CardContent } from "@/components/ui/card";
import { getPlayer } from "@/lib/player";
import { formatKoreanDate, todayKst } from "@/lib/quiz/dates";
import { findTodayDailyAttempt } from "@/lib/quiz/engine";
import { dailyStats } from "@/lib/quiz/stats";

export const metadata: Metadata = { title: "오늘의 5라운드" };
export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const player = await getPlayer();
  const existing = await findTodayDailyAttempt(player);
  if (existing) redirect(existing.finishedAt ? `/result/${existing.id}` : `/play/${existing.id}`);
  const stats = await dailyStats();

  return (
    <PageShell narrow>
      <PageTitle
        eyebrow={formatKoreanDate(todayKst())}
        title="오늘의 5라운드"
        description="모두에게 같은 5문제가 나갑니다. 1라운드는 가볍게, 5라운드는 코어 팬도 고민할 문제로. 하루에 한 번만 도전할 수 있어요."
      />
      <Card>
        <CardContent className="space-y-4">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>· 답을 고르면 바로 판정과 해설이 나옵니다</li>
            <li>· 결과는 이모지 카드로 친구에게 공유할 수 있어요</li>
            <li>· 문제는 매일 한국 시간 자정에 바뀝니다</li>
            {stats.players > 0 && <li>· 오늘 {stats.players.toLocaleString()}명이 도전했어요</li>}
          </ul>
          <StartQuizForm mode="daily" label="공 울리기 — 1라운드 시작" />
        </CardContent>
      </Card>
    </PageShell>
  );
}
