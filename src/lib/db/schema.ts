import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { LocalizedQuestion, Source, Temporal } from "@/lib/quiz/schema";

// --- 회원 ---------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  /** Fight IQ 레이팅 (Elo). 문제와 맞붙어 오르내린다 — lib/quiz/rating.ts */
  rating: real("rating").notNull().default(1000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
});
export type User = typeof users.$inferSelect;

export const sessions = pgTable(
  "sessions",
  {
    // 쿠키 토큰의 SHA-256. 원본 토큰은 DB에 남지 않는다.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// --- 콘텐츠: 사실 은행 → 문제 은행 (기획서 §6-2) ------------------------------

export const contentStatus = pgEnum("content_status", ["draft", "review", "published", "retired"]);

export const facts = pgTable("facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  statementEn: text("statement_en").notNull(),
  statementKo: text("statement_ko"),
  sport: text("sport").notNull(),
  topics: text("topics").array().notNull().default([]),
  temporal: jsonb("temporal").$type<Temporal>().notNull().default({ kind: "evergreen" }),
  sources: jsonb("sources").$type<Source[]>().notNull().default([]),
  status: contentStatus("status").notNull().default("review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: integer("version").notNull().default(1),
    type: text("type").notNull().default("single_choice"),
    sport: text("sport").notNull(),
    topics: text("topics").array().notNull().default([]),
    /** AI·출제자가 붙인 처음 난이도 (1~5) */
    difficulty: integer("difficulty").notNull(),
    temporal: jsonb("temporal").$type<Temporal>().notNull().default({ kind: "evergreen" }),
    region: text("region").array().notNull().default(["global"]),
    answerChoiceId: text("answer_choice_id").notNull(),
    /** 언어별 문항·보기·해설 { ko: {...}, en?: {...} } */
    content: jsonb("content").$type<Partial<Record<"ko" | "en", LocalizedQuestion>> & { ko: LocalizedQuestion }>().notNull(),
    sources: jsonb("sources").$type<Source[]>().notNull().default([]),
    provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull().default({}),
    status: contentStatus("status").notNull().default("review"),
    /** 중복 방지 — lib/quiz/schema.ts questionFingerprint */
    fingerprint: text("fingerprint").notNull(),
    /** 실측 난이도 (Elo). 많이 풀릴수록 difficulty 보다 정확하다 */
    rating: real("rating").notNull(),
    timesAnswered: integer("times_answered").notNull().default(0),
    timesCorrect: integer("times_correct").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("questions_fingerprint_idx").on(t.fingerprint),
    index("questions_status_sport_idx").on(t.status, t.sport),
  ],
);
export type Question = typeof questions.$inferSelect;

export const questionFacts = pgTable(
  "question_facts",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    factId: uuid("fact_id")
      .notNull()
      .references(() => facts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.factId] })],
);

// --- 풀이 -----------------------------------------------------------------------

export const quizMode = pgEnum("quiz_mode", ["daily", "sparring", "test"]);
export type QuizMode = (typeof quizMode.enumValues)[number];

export type AttemptResult = {
  correct: number;
  total: number;
  /** Fight IQ 테스트 전용 */
  iq?: number;
  archetype?: string;
  bySport?: Record<string, { correct: number; total: number }>;
  ratingBefore?: number;
  ratingAfter?: number;
};

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** 비회원 식별 쿠키 (fiq_anon). 로그인하면 userId 로 옮긴다 */
    anonId: text("anon_id"),
    mode: quizMode("mode").notNull(),
    /** 오늘의 5라운드 날짜 (KST) */
    dailyDate: date("daily_date"),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
    questionIds: uuid("question_ids").array().notNull(),
    result: jsonb("result").$type<AttemptResult>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("attempts_user_idx").on(t.userId, t.startedAt),
    index("attempts_anon_idx").on(t.anonId, t.startedAt),
    index("attempts_daily_idx").on(t.dailyDate),
  ],
);
export type Attempt = typeof attempts.$inferSelect;

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    questionVersion: integer("question_version").notNull(),
    choiceId: text("choice_id").notNull(),
    correct: boolean("correct").notNull(),
    elapsedMs: integer("elapsed_ms"),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.questionId] }), index("attempt_answers_question_idx").on(t.questionId)],
);

/** 오늘의 5라운드 — 날짜마다 전원에게 같은 문제 */
export const dailySets = pgTable("daily_sets", {
  date: date("date").primaryKey(),
  questionIds: uuid("question_ids").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- 품질 관리 --------------------------------------------------------------------

export const reportReason = pgEnum("report_reason", ["wrong_answer", "outdated", "ambiguous", "other"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    questionVersion: integer("question_version").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    reason: reportReason("reason").notNull(),
    note: text("note"),
    status: reportStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt), index("reports_question_idx").on(t.questionId)],
);

/** AI 생성 파이프라인 실행 기록 (워커가 쓴다) */
export const generationRuns = pgTable("generation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const generationVerdict = pgEnum("generation_verdict", ["published", "review", "rejected", "error"]);

/** 생성 시도 하나 (주제 하나 → 문제 하나). 같은 주제를 다시 고르지 않는 데도 쓴다 */
export const generationItems = pgTable(
  "generation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").references(() => generationRuns.id, { onDelete: "set null" }),
    sport: text("sport").notNull(),
    topic: text("topic").notNull(),
    brief: text("brief").notNull(),
    risk: text("risk").notNull(),
    verdict: generationVerdict("verdict").notNull(),
    reason: text("reason"),
    questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
    /** 단계별 기록 (출처·사실·검사 결과·호출 시간) */
    trace: jsonb("trace").$type<Record<string, unknown>>().notNull().default({}),
    llmCalls: integer("llm_calls").notNull().default(0),
    seconds: integer("seconds").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("generation_items_created_idx").on(t.createdAt), index("generation_items_cell_idx").on(t.sport, t.topic)],
);
