-- Live fares from an API supplier (Duffel) alongside fares typed in by the desk.
ALTER TABLE "flight_options" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL', ADD COLUMN "external_id" TEXT;

ALTER TABLE "flight_ticketing"
  ADD COLUMN "external_provider" TEXT,
  ADD COLUMN "external_order_id" TEXT,
  ADD COLUMN "external_status" TEXT,
  ADD COLUMN "external_attempt_at" TIMESTAMPTZ;

-- One supplier order can only ever belong to one file.
CREATE UNIQUE INDEX "flight_ticketing_external_order_key" ON "flight_ticketing"("external_provider", "external_order_id") WHERE "external_order_id" IS NOT NULL;
