/**
 * 문제 규격 (docs/기획서.md §5). AI 생성 워커와 관리자 가져오기가 같은 규격을 쓴다.
 * 정답은 보기 텍스트가 아니라 보기 id 로 저장해서 번역·섞기와 무관하게 유지한다.
 */
import { z } from "zod";
import { SPORTS, TOPICS } from "./taxonomy";

export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const choiceSchema = z.object({
  id: z.string().regex(/^[a-z]$/),
  text: z.string().trim().min(1).max(200),
});

export const localizedQuestionSchema = z.object({
  stem: z.string().trim().min(5).max(500),
  choices: z.array(choiceSchema).min(2).max(6),
  explanation: z.string().trim().min(10).max(1500),
  translation: z
    .object({ status: z.enum(["original", "machine", "reviewed"]) })
    .default({ status: "original" }),
});
export type LocalizedQuestion = z.infer<typeof localizedQuestionSchema>;

export const temporalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("evergreen") }),
  z.object({
    kind: z.literal("as_of"),
    as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    review_after: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({ kind: z.literal("rule_versioned") }),
]);
export type Temporal = z.infer<typeof temporalSchema>;

export const sourceSchema = z.object({
  url: z.url(),
  title: z.string().max(300).optional(),
  accessed_at: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;

export const QUESTION_STATUSES = ["draft", "review", "published", "retired"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const questionInputSchema = z
  .object({
    type: z.enum(["single_choice", "true_false"]).default("single_choice"),
    sport: z.enum(SPORTS),
    topics: z.array(z.enum(TOPICS)).min(1).max(3),
    difficulty: z.number().int().min(1).max(5),
    temporal: temporalSchema.default({ kind: "evergreen" }),
    region: z.array(z.string().min(2).max(8)).default(["global"]),
    answer: z.object({ choice_id: z.string().regex(/^[a-z]$/) }),
    content: z.object({ ko: localizedQuestionSchema, en: localizedQuestionSchema.optional() }),
    sources: z.array(sourceSchema).default([]),
    provenance: z.record(z.string(), z.unknown()).default({}),
    status: z.enum(QUESTION_STATUSES).default("review"),
  })
  .superRefine((q, ctx) => {
    for (const [locale, text] of Object.entries(q.content)) {
      if (!text) continue;
      const ids = text.choices.map((c) => c.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: "custom", path: ["content", locale, "choices"], message: "보기 id 가 중복됩니다" });
      }
      if (!ids.includes(q.answer.choice_id)) {
        ctx.addIssue({ code: "custom", path: ["answer"], message: `정답 id 가 ${locale} 보기에 없습니다` });
      }
      const texts = text.choices.map((c) => c.text.trim().toLowerCase());
      if (new Set(texts).size !== texts.length) {
        ctx.addIssue({ code: "custom", path: ["content", locale, "choices"], message: "보기 내용이 중복됩니다" });
      }
    }
    if (q.temporal.kind === "as_of" && !/\d{4}/.test(q.content.ko.stem)) {
      ctx.addIssue({ code: "custom", path: ["content", "ko", "stem"], message: "기준 시점 문제는 문항에 연도·날짜를 적어야 합니다" });
    }
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

/** 중복 검사용 지문: 공백·문장부호를 지운 한국어 문항 + 정답 보기 */
export function questionFingerprint(q: Pick<QuestionInput, "content" | "answer">) {
  const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const answer = q.content.ko.choices.find((c) => c.id === q.answer.choice_id)?.text ?? "";
  return `${norm(q.content.ko.stem)}|${norm(answer)}`;
}
