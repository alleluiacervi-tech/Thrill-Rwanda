-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "exclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "inclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "itinerary" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "offer_approval" TEXT,
ADD COLUMN     "suitability" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "service_publications" (
    "service" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ENQUIRY',
    "evidence" TEXT NOT NULL,
    "approved_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_publications_pkey" PRIMARY KEY ("service")
);

-- CreateTable
CREATE TABLE "operations_policy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "support_hours" TEXT NOT NULL,
    "escalation" TEXT NOT NULL,
    "emergency_notice" TEXT NOT NULL,
    "document_purpose" TEXT NOT NULL,
    "document_days" INTEGER NOT NULL,
    "documents_enabled" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "operations_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_cases" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "enquiry_id" UUID,
    "booking_id" UUID,
    "owner_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "next_action_at" TIMESTAMPTZ NOT NULL,
    "outcome" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_activities" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "intent_key" UUID NOT NULL,
    "input_hash" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_daily" (
    "day" DATE NOT NULL,
    "service" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "interaction_daily_pkey" PRIMARY KEY ("day","service","placement")
);

-- CreateTable
CREATE TABLE "operations_audit" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_cases_reference_key" ON "support_cases"("reference");

-- CreateIndex
CREATE INDEX "support_cases_owner_id_status_next_action_at_idx" ON "support_cases"("owner_id", "status", "next_action_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_activities_intent_key_key" ON "support_activities"("intent_key");

-- CreateIndex
CREATE INDEX "operations_audit_entity_id_created_at_idx" ON "operations_audit"("entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_activities" ADD CONSTRAINT "support_activities_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
