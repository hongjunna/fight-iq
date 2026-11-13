import { facts as factsTable, generationItems, questionFacts, questions } from "@/lib/db/schema";
import { initialQuestionRating } from "@/lib/quiz/rating";
import { questionFingerprint } from "@/lib/quiz/schema";
import { db } from "./db";
import type { PipelineResult, Subject } from "./pipeline";

/** 결과를 저장한다: 사실 → 문제 → 연결 → 생성 기록. 이미 있는 문제(같은 지문)면 중복으로 기록만 남긴다 */
export async function saveResult(runId: string, subject: Subject, result: PipelineResult, seconds: number) {
  let verdict = result.verdict;
  let reason = result.reason ?? null;
  let questionId: string | null = null;

  if (result.question && (verdict === "published" || verdict === "review")) {
    const q = result.question;
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(questions)
        .values({
          type: q.type,
          sport: q.sport,
          topics: q.topics,
          difficulty: q.difficulty,
          temporal: q.temporal,
          region: q.region,
          answerChoiceId: q.answer.choice_id,
          content: q.content,
          sources: q.sources,
          provenance: q.provenance,
          status: q.status,
          fingerprint: questionFingerprint(q),
          rating: initialQuestionRating(q.difficulty),
          publishedAt: q.status === "published" ? new Date() : null,
        })
        .onConflictDoNothing({ target: questions.fingerprint })
        .returning({ id: questions.id });
      if (!row) {
        verdict = "rejected";
        reason = "이미 있는 문제와 같음";
        return;
      }
      questionId = row.id;
      for (const f of result.facts) {
        const [fact] = await tx
          .insert(factsTable)
          .values({
            statementEn: f.statementEn,
            sport: subject.sport,
            topics: [subject.topic],
            temporal: f.timeSensitive ? { kind: "as_of", as_of: new Date().toISOString().slice(0, 10) } : { kind: "evergreen" },
            sources: f.supports.map((s) => ({ url: s.url, title: s.quote.slice(0, 280) })),
            status: "published",
          })
          .returning({ id: factsTable.id });
        await tx.insert(questionFacts).values({ questionId: row.id, factId: fact.id });
      }
    });
  }

  await db.insert(generationItems).values({
    runId,
    sport: subject.sport,
    topic: subject.topic,
    brief: subject.brief,
    risk: subject.risk,
    verdict,
    reason,
    questionId,
    trace: { ...result.trace, calls: result.calls },
    llmCalls: result.calls.length,
    seconds,
  });
  return { verdict, reason, questionId };
}
