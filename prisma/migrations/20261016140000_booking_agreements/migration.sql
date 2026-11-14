-- Signed car hire agreements, stored as signed so a later template edit
-- cannot change what the customer agreed to.
CREATE TABLE "booking_agreements" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signed_name" TEXT NOT NULL,
    "signed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "booking_agreements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_agreements_booking_id_key" ON "booking_agreements"("booking_id");

ALTER TABLE "booking_agreements" ADD CONSTRAINT "booking_agreements_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
