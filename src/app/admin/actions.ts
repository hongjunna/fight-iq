"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { generationRuns, questions, reports } from "@/lib/db/schema";
import { insertQuestions } from "@/lib/quiz/engine";
import { questionInputSchema } from "@/lib/quiz/schema";

export async function setQuestionStatus(ids: string[], status: "published" | "retired" | "review") {
  await requireAdmin();
  const parsed = z.array(z.uuid()).min(1).max(200).safeParse(ids);
  if (!parsed.success) return;
  await db
    .update(questions)
    .set({ status, updatedAt: new Date(), ...(status === "published" ? { publishedAt: new Date() } : {}) })
    .where(inArray(questions.id, parsed.data));
  revalidatePath("/admin", "layout");
}

export async function resolveReport(reportId: string, outcome: "resolved" | "dismissed", retireQuestion: boolean) {
  await requireAdmin();
  const id = z.uuid().parse(reportId);
  const [report] = await db
    .update(reports)
    .set({ status: outcome, resolvedAt: new Date() })
    .where(eq(reports.id, id))
    .returning({ questionId: reports.questionId });
  if (report && retireQuestion) {
    await db.update(questions).set({ status: "retired", updatedAt: new Date() }).where(eq(questions.id, report.questionId));
  }
  revalidatePath("/admin", "layout");
}

export type GenerateState = { message?: string; error?: string };

/** "지금 문제 생성하기" — 워커가 30초 안에 가져가 시간대와 관계없이 바로 만든다 (src/worker/main.ts) */
export async function requestGeneration(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  await requireAdmin();
  const count = Number(formData.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > 20) return { error: "1~20개 사이로 골라 주세요" };
  const [open] = await db
    .select({ id: generationRuns.id })
    .from(generationRuns)
    .where(inArray(generationRuns.kind, ["manual-pending", "manual-running"]))
    .limit(1);
  if (open) return { error: "이미 진행 중인 요청이 있습니다. 끝난 뒤 다시 눌러 주세요." };
  await db.insert(generationRuns).values({ kind: "manual-pending", stats: { requested: count } });
  revalidatePath("/admin", "layout");
  return { message: `${count}개 생성을 요청했습니다. 워커가 곧 시작합니다.` };
}

export async function cancelGenerationRequest() {
  await requireAdmin();
  await db.update(generationRuns).set({ kind: "manual-cancelled", finishedAt: new Date() }).where(eq(generationRuns.kind, "manual-pending"));
  revalidatePath("/admin", "layout");
}

export type ImportState = { message?: string; errors?: string[] };

/** 문제 JSON 가져오기 — 배열 또는 { questions: [...] }. 규격은 lib/quiz/schema.ts */
export async function importQuestions(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await requireAdmin();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("json") ?? ""));
  } catch {
    return { errors: ["JSON 형식이 아닙니다"] };
  }
  const items = Array.isArray(raw) ? raw : (raw as { questions?: unknown[] })?.questions;
  if (!Array.isArray(items) || items.length === 0) return { errors: ["문제 배열이 비어 있습니다"] };
  if (items.length > 500) return { errors: ["한 번에 500개까지 넣을 수 있습니다"] };

  const defaultStatus = formData.get("status") === "published" ? "published" : "review";
  const valid = [];
  const errors: string[] = [];
  for (const [i, item] of items.entries()) {
    const parsed = questionInputSchema.safeParse({ status: defaultStatus, ...(item as object) });
    if (parsed.success) valid.push(parsed.data);
    else errors.push(`#${i + 1}: ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join(", ")}`);
  }
  const { inserted, duplicates } = valid.length ? await insertQuestions(valid) : { inserted: 0, duplicates: 0 };
  revalidatePath("/admin", "layout");
  return { message: `${inserted}개 추가, 중복 ${duplicates}개 건너뜀, 오류 ${errors.length}개`, errors: errors.slice(0, 20) };
}
