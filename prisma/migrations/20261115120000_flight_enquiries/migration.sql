-- Additive guest lead storage; existing booking/payment tables are unchanged.
CREATE TABLE "enquiries" (
  "id" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "submission_key" UUID NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "contact_key" TEXT NOT NULL,
  "service" TEXT NOT NULL DEFAULT 'FLIGHT',
  "source" TEXT NOT NULL DEFAULT 'WEBSITE',
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "reply_channel" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "consent_version" TEXT NOT NULL,
  "consent_text" TEXT NOT NULL,
  "privacy_version" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "enquiries_reference_key" ON "enquiries"("reference");
CREATE UNIQUE INDEX "enquiries_submission_key_key" ON "enquiries"("submission_key");
CREATE INDEX "enquiries_created_at_idx" ON "enquiries"("created_at");
CREATE INDEX "enquiries_contact_key_created_at_idx" ON "enquiries"("contact_key", "created_at");
