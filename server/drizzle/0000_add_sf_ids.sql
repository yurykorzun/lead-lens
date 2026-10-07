-- First tracked migration. The tables themselves were created with drizzle-kit push,
-- so this only adds the Salesforce Id columns and is safe to re-run.
-- Rollback: ALTER TABLE "users" DROP COLUMN IF EXISTS "sf_contact_id", DROP COLUMN IF EXISTS "sf_user_id";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sf_contact_id" varchar(18);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sf_user_id" varchar(18);
