-- Preserve exact email bytes across provider-idempotent retries.
ALTER TABLE "notification_jobs" ADD COLUMN "message" JSONB;
