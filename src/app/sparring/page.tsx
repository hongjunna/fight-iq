import type { Metadata } from "next";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { ChipGroup } from "@/components/quiz/chip-group";
import { StartQuizForm } from "@/components/quiz/start-quiz-form";
import { Card, CardContent } from "@/components/ui/card";
import { isSport } from "@/lib/quiz/engine";
import { publishedCountsBySport } from "@/lib/quiz/stats";
import { DIFFICULTY_LABELS, SPORT_LABELS, SPORTS } from "@/lib/quiz/taxonomy";

export const metadata: Metadata = { title: "스파링" };
export const dynamic = "force-dynamic";

export default async function SparringPage({ searchParams }: PageProps<"/sparring">) {
  const sp = await searchParams;
  const sport = isSport(sp.sport) ? sp.sport : "";
  const counts = await publishedCountsBySport();

  return (
    <PageShell narrow>
      <PageTitle eyebrow="연습 모드" title="스파링" description="종목과 난이도를 골라 10문제씩 풀어 보세요. 안 푼 문제부터 나옵니다." />
      <Card>
        <CardContent>
          <StartQuizForm mode="sparring" label="스파링 시작">
            <ChipGroup
              name="sport"
              legend="종목"
              defaultValue={sport}
              options={[
                { value: "", label: "전체" },
                ...SPORTS.filter((s) => counts[s]).map((s) => ({ value: s, label: `${SPORT_LABELS[s]} ${counts[s]}` })),
              ]}
            />
            <ChipGroup
              name="difficulty"
              legend="난이도"
              defaultValue=""
              options={[{ value: "", label: "섞어서" }, ...([1, 2, 3, 4, 5] as const).map((d) => ({ value: String(d), label: `${d} · ${DIFFICULTY_LABELS[d]}` }))]}
            />
          </StartQuizForm>
        </CardContent>
      </Card>
    </PageShell>
  );
}
