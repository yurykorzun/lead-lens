-- Notes on a borrower, kept in Lead Lens only (nothing is written to Salesforce). Safe to re-run.
-- Rollback: DROP TABLE IF EXISTS "notes";
CREATE TABLE IF NOT EXISTS "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sf_record_id" varchar(18) NOT NULL,
	"author_id" uuid,
	"author_name" varchar(255) NOT NULL,
	"author_role" varchar(20) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_record_idx" ON "notes" USING btree ("sf_record_id","created_at");
