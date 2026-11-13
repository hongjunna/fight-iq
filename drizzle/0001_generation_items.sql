CREATE TYPE "public"."generation_verdict" AS ENUM('published', 'review', 'rejected', 'error');--> statement-breakpoint
CREATE TABLE "generation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"sport" text NOT NULL,
	"topic" text NOT NULL,
	"brief" text NOT NULL,
	"risk" text NOT NULL,
	"verdict" "generation_verdict" NOT NULL,
	"reason" text,
	"question_id" uuid,
	"trace" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"llm_calls" integer DEFAULT 0 NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_items" ADD CONSTRAINT "generation_items_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_items" ADD CONSTRAINT "generation_items_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_items_created_idx" ON "generation_items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "generation_items_cell_idx" ON "generation_items" USING btree ("sport","topic");