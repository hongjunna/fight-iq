import type { Metadata } from "next";
import { BeltBadge } from "@/components/brand/belt-badge";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { StartQuizForm } from "@/components/quiz/start-quiz-form";
import { Card, CardContent } from "@/components/ui/card";
import { BELTS } from "@/lib/quiz/rating";

export const metadata: Metadata = {
  title: "Fight IQ 테스트",
  description: "20문제로 알아보는 나의 격투 지식 수준. 종목별 강점과 벨트 등급을 확인하세요.",
};

export default function TestPage() {
  return (
    <PageShell narrow>
      <PageTitle
        eyebrow="진단 테스트"
        title="Fight IQ 테스트"
        description="MMA부터 레슬링까지 20문제. 쉬운 문제에서 시작해 점점 어려워집니다. 어려운 문제일수록 점수에 크게 반영돼요."
      />
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold">결과로 받는 것</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>· Fight IQ 점수 (70~160)</li>
              <li>· 종목별 정답률과 나의 유형 (예: 그래플링 브레인)</li>
              <li>· 벨트 등급과 공유용 결과 페이지</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            {BELTS.map((b) => (
              <BeltBadge key={b.id} belt={b.id} label={b.label.replace(" 벨트", "")} size="sm" />
            ))}
          </div>
          <StartQuizForm mode="test" label="테스트 시작 (약 5분)" />
        </CardContent>
      </Card>
    </PageShell>
  );
}
