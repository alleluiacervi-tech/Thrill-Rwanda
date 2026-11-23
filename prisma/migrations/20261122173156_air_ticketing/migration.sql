-- CreateEnum
CREATE TYPE "TicketingStatus" AS ENUM ('OPTIONS', 'AWAITING_PAYMENT', 'READY_TO_TICKET', 'TICKETING', 'ISSUED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "flight_ticketing" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "status" "TicketingStatus" NOT NULL DEFAULT 'OPTIONS',
    "version" INTEGER NOT NULL DEFAULT 0,
    "partner" TEXT NOT NULL DEFAULT '',
    "options_shared_at" TIMESTAMPTZ,
    "ticket_time_limit" TIMESTAMPTZ,
    "pnr" TEXT,
    "partner_reference" TEXT,
    "issuance_evidence" TEXT,
    "issued_at" TIMESTAMPTZ,
    "issued_by_id" UUID,
    "delivered_at" TIMESTAMPTZ,
    "redacted_at" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flight_ticketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_options" (
    "id" UUID NOT NULL,
    "ticketing_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "fare_basis" TEXT NOT NULL DEFAULT '',
    "baggage" TEXT NOT NULL DEFAULT '',
    "change_rule" TEXT NOT NULL DEFAULT '',
    "refund_rule" TEXT NOT NULL DEFAULT '',
    "valid_until" TIMESTAMPTZ NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "flight_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_segments" (
    "id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "airline" TEXT NOT NULL,
    "flight_number" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "depart_local" TEXT NOT NULL,
    "arrive_local" TEXT NOT NULL,
    "cabin" TEXT NOT NULL DEFAULT 'ECONOMY',
    "booking_class" TEXT NOT NULL DEFAULT '',
    "terminal" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "flight_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_passengers" (
    "id" UUID NOT NULL,
    "ticketing_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ADULT',
    "title" TEXT NOT NULL DEFAULT '',
    "given_names" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "date_of_birth" TEXT,
    "nationality" TEXT,
    "document_number" TEXT,
    "document_expiry" TEXT,
    "ticket_number" TEXT,
    "previous_tickets" TEXT[],
    "ticketed_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "flight_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_service_requests" (
    "id" UUID NOT NULL,
    "ticketing_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "origin" TEXT NOT NULL DEFAULT 'STAFF',
    "requested_by_id" UUID,
    "description" TEXT NOT NULL,
    "passenger_ids" TEXT[],
    "partner_evidence" TEXT,
    "currency" TEXT,
    "fee_minor" INTEGER NOT NULL DEFAULT 0,
    "refund_minor" INTEGER NOT NULL DEFAULT 0,
    "resolution" TEXT,
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flight_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flight_ticketing_enquiry_id_key" ON "flight_ticketing"("enquiry_id");

-- CreateIndex
CREATE INDEX "flight_ticketing_status_ticket_time_limit_idx" ON "flight_ticketing"("status", "ticket_time_limit");

-- CreateIndex
CREATE UNIQUE INDEX "flight_options_ticketing_id_position_key" ON "flight_options"("ticketing_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "flight_segments_option_id_position_key" ON "flight_segments"("option_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "flight_passengers_ticket_number_key" ON "flight_passengers"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "flight_passengers_ticketing_id_position_key" ON "flight_passengers"("ticketing_id", "position");

-- CreateIndex
CREATE INDEX "flight_service_requests_status_created_at_idx" ON "flight_service_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "flight_service_requests_ticketing_id_number_key" ON "flight_service_requests"("ticketing_id", "number");

-- AddForeignKey
ALTER TABLE "flight_ticketing" ADD CONSTRAINT "flight_ticketing_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_options" ADD CONSTRAINT "flight_options_ticketing_id_fkey" FOREIGN KEY ("ticketing_id") REFERENCES "flight_ticketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_segments" ADD CONSTRAINT "flight_segments_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "flight_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_passengers" ADD CONSTRAINT "flight_passengers_ticketing_id_fkey" FOREIGN KEY ("ticketing_id") REFERENCES "flight_ticketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_service_requests" ADD CONSTRAINT "flight_service_requests_ticketing_id_fkey" FOREIGN KEY ("ticketing_id") REFERENCES "flight_ticketing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only one fare option can be selected per ticketing file.
CREATE UNIQUE INDEX "flight_options_one_selected" ON "flight_options"("ticketing_id") WHERE "selected";

-- Ticket and passenger counts stay sensible at the database level too.
ALTER TABLE "flight_ticketing" ADD CONSTRAINT "flight_ticketing_version_nonneg" CHECK ("version" >= 0);
ALTER TABLE "flight_options" ADD CONSTRAINT "flight_options_total_positive" CHECK ("total_minor" > 0);
ALTER TABLE "flight_service_requests" ADD CONSTRAINT "flight_service_amounts_nonneg" CHECK ("fee_minor" >= 0 AND "refund_minor" >= 0);
