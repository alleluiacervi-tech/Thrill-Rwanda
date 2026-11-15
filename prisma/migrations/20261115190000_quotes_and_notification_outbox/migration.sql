CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'BLOCKED', 'CANCELLED');
CREATE TABLE "quote_versions" (
 "id" UUID NOT NULL, "enquiry_id" UUID NOT NULL, "number" INTEGER NOT NULL,
 "intent_key" UUID NOT NULL, "input_hash" TEXT NOT NULL, "content_hash" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL, "internal_notes" TEXT NOT NULL DEFAULT '', "currency" TEXT NOT NULL, "total_minor" INTEGER NOT NULL,
 "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "expires_at" TIMESTAMPTZ NOT NULL,
 "payment_deadline" TIMESTAMPTZ NOT NULL, "created_by_id" UUID NOT NULL,
 CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "quote_versions_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "quote_versions_intent_key_key" ON "quote_versions"("intent_key");
CREATE UNIQUE INDEX "quote_versions_enquiry_id_number_key" ON "quote_versions"("enquiry_id", "number");
CREATE TABLE "quote_acceptances" (
 "id" UUID NOT NULL, "enquiry_id" UUID NOT NULL, "quote_id" UUID NOT NULL, "customer_name" TEXT NOT NULL,
 "channel" TEXT NOT NULL, "evidence" TEXT NOT NULL, "actor_id" UUID NOT NULL, "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "quote_acceptances_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "quote_acceptances_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "quote_acceptances_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "quote_acceptances_enquiry_id_key" ON "quote_acceptances"("enquiry_id");
CREATE UNIQUE INDEX "quote_acceptances_quote_id_key" ON "quote_acceptances"("quote_id");
CREATE TABLE "notification_jobs" (
 "id" UUID NOT NULL, "enquiry_id" UUID NOT NULL, "quote_id" UUID, "dedupe_key" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "channel" TEXT NOT NULL, "recipient_id" UUID, "to_email" TEXT,
 "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "lease_until" TIMESTAMPTZ, "lease_token" UUID,
 "first_attempt_at" TIMESTAMPTZ, "sent_at" TIMESTAMPTZ, "last_error" TEXT, "provider_id" TEXT,
 "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "notification_jobs_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "notification_jobs_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notification_jobs_dedupe_key_key" ON "notification_jobs"("dedupe_key");
CREATE INDEX "notification_jobs_status_next_attempt_at_idx" ON "notification_jobs"("status", "next_attempt_at");
CREATE INDEX "notification_jobs_enquiry_id_created_at_idx" ON "notification_jobs"("enquiry_id", "created_at");
CREATE TABLE "notification_attempts" (
 "id" UUID NOT NULL, "job_id" UUID NOT NULL, "number" INTEGER NOT NULL, "status" TEXT NOT NULL,
 "error_code" TEXT, "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "completed_at" TIMESTAMPTZ,
 CONSTRAINT "notification_attempts_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "notification_attempts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "notification_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "notification_attempts_job_id_started_at_idx" ON "notification_attempts"("job_id", "started_at");
