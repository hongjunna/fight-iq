CREATE TYPE "public"."content_status" AS ENUM('draft', 'review', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."quiz_mode" AS ENUM('daily', 'sparring', 'test');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('wrong_answer', 'outdated', 'ambiguous', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"question_version" integer NOT NULL,
	"choice_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"elapsed_ms" integer,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_answers_attempt_id_question_id_pk" PRIMARY KEY("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anon_id" text,
	"mode" "quiz_mode" NOT NULL,
	"daily_date" date,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"question_ids" uuid[] NOT NULL,
	"result" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_sets" (
	"date" date PRIMARY KEY NOT NULL,
	"question_ids" uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_en" text NOT NULL,
	"statement_ko" text,
	"sport" text NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"temporal" jsonb DEFAULT '{"kind":"evergreen"}'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "content_status" DEFAULT 'review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "question_facts" (
	"question_id" uuid NOT NULL,
	"fact_id" uuid NOT NULL,
	CONSTRAINT "question_facts_question_id_fact_id_pk" PRIMARY KEY("question_id","fact_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"type" text DEFAULT 'single_choice' NOT NULL,
	"sport" text NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"difficulty" integer NOT NULL,
	"temporal" jsonb DEFAULT '{"kind":"evergreen"}'::jsonb NOT NULL,
	"region" text[] DEFAULT '{"global"}' NOT NULL,
	"answer_choice_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "content_status" DEFAULT 'review' NOT NULL,
	"fingerprint" text NOT NULL,
	"rating" real NOT NULL,
	"times_answered" integer DEFAULT 0 NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"question_version" integer NOT NULL,
	"user_id" uuid,
	"anon_id" text,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"rating" real DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_facts" ADD CONSTRAINT "question_facts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_facts" ADD CONSTRAINT "question_facts_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_answers_question_idx" ON "attempt_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "attempts_user_idx" ON "attempts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "attempts_anon_idx" ON "attempts" USING btree ("anon_id","started_at");--> statement-breakpoint
CREATE INDEX "attempts_daily_idx" ON "attempts" USING btree ("daily_date");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_fingerprint_idx" ON "questions" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "questions_status_sport_idx" ON "questions" USING btree ("status","sport");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_question_idx" ON "reports" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");