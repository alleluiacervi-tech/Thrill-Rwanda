CREATE TYPE "StaffRole" AS ENUM ('SALES', 'OPERATIONS', 'FINANCE');
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'NEEDS_INFORMATION', 'QUOTE_SENT', 'AWAITING_PAYMENT', 'PARTNER_PROCESSING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'LOST');
ALTER TABLE "users" ADD COLUMN "staff_role" "StaffRole";
ALTER TABLE "enquiries"
 ADD COLUMN "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
 ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "owner_id" UUID,
 ADD COLUMN "next_follow_up" TIMESTAMPTZ,
 ADD COLUMN "first_response_at" TIMESTAMPTZ,
 ADD COLUMN "outcome_reason" TEXT;
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "enquiries_owner_id_status_next_follow_up_idx" ON "enquiries"("owner_id", "status", "next_follow_up");
CREATE TABLE "enquiry_activities" (
 "id" UUID NOT NULL, "enquiry_id" UUID NOT NULL, "actor_id" UUID NOT NULL,
 "kind" TEXT NOT NULL, "body" TEXT, "changes" JSONB NOT NULL,
 "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "enquiry_activities_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "enquiry_activities_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "enquiry_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "enquiry_activities_enquiry_id_created_at_idx" ON "enquiry_activities"("enquiry_id", "created_at");

CREATE TABLE "staff_access_changes" (
 "id" UUID NOT NULL, "actor_id" UUID NOT NULL, "target_id" UUID NOT NULL,
 "previous_role" TEXT, "next_role" TEXT,
 "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "staff_access_changes_pkey" PRIMARY KEY ("id")
);
