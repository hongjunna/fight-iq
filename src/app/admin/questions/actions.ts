"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { questions, reports } from "@/lib/db/schema";
import { questionFingerprint, questionInputSchema } from "@/lib/quiz/schema";

export type EditState = { ok?: boolean; error?: string; issues?: string[] };

/**
 * 문제 수정. 앱·워커와 같은 zod 규격으로 다시 검사하고 버전을 올린다.
 * 영어판·출처·생성 기록은 그대로 둔다. (풀이 기록은 문제 버전과 함께 남아 있어 수정 전 풀이와 구분된다)
 */
export async function updateQuestion(id: string, _prev: EditState, formData: FormData): Promise<EditState> {
  await requireAdmin();
  const [current] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!current) return { error: "문제를 찾을 수 없습니다" };

  const choiceIds = formData.getAll("choiceId").map(String);
  const choiceTexts = formData.getAll("choiceText").map(String);
  const choices = choiceIds.map((cid, i) => ({ id: cid, text: (choiceTexts[i] ?? "").trim() })).filter((c) => c.text);
  const temporalKind = String(formData.get("temporalKind") ?? "evergreen");
  const asOf = String(formData.get("asOf") ?? "");
  const temporal =
    temporalKind === "as_of" ? { kind: "as_of", as_of: asOf } : temporalKind === "rule_versioned" ? { kind: "rule_versioned" } : { kind: "evergreen" };

  const parsed = questionInputSchema.safeParse({
    type: current.type,
    sport: formData.get("sport"),
    topics: formData.getAll("topics").map(String),
    difficulty: Number(formData.get("difficulty")),
    temporal,
    region: current.region,
    answer: { choice_id: formData.get("answer") },
    content: {
      ...current.content,
      ko: {
        stem: String(formData.get("stem") ?? ""),
        choices,
        explanation: String(formData.get("explanation") ?? ""),
        translation: current.content.ko.translation ?? { status: "original" },
      },
    },
    sources: current.sources,
    provenance: current.provenance,
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "입력값을 확인해 주세요", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const q = parsed.data;

  const fingerprint = questionFingerprint(q);
  const [dup] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.fingerprint, fingerprint), ne(questions.id, id)))
    .limit(1);
  if (dup) return { error: "같은 문항·정답의 다른 문제가 이미 있습니다" };

  const contentChanged =
    JSON.stringify(current.content.ko) !== JSON.stringify(q.content.ko) || current.answerChoiceId !== q.answer.choice_id;
  await db
    .update(questions)
    .set({
      sport: q.sport,
      topics: q.topics,
      difficulty: q.difficulty,
      temporal: q.temporal,
      answerChoiceId: q.answer.choice_id,
      content: q.content,
      status: q.status,
      fingerprint,
      version: contentChanged ? current.version + 1 : current.version,
      provenance: contentChanged ? { ...current.provenance, edited_by_admin: true } : current.provenance,
      updatedAt: new Date(),
      publishedAt: q.status === "published" && !current.publishedAt ? new Date() : current.publishedAt,
    })
    .where(eq(questions.id, id));

  // 내용을 고쳤으면 이 문제에 걸린 열린 신고는 처리된 것으로 본다
  if (contentChanged) {
    await db.update(reports).set({ status: "resolved", resolvedAt: new Date() }).where(and(eq(reports.questionId, id), eq(reports.status, "open")));
  }
  revalidatePath(`/admin/questions/${id}`);
  revalidatePath("/admin/questions");
  return { ok: true };
}
