-- Car hire: licence and ID copies, stored privately against the booking.
CREATE TYPE "BookingDocumentKind" AS ENUM ('DRIVING_LICENCE', 'ID_DOCUMENT');

CREATE TABLE "booking_documents" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "kind" "BookingDocumentKind" NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_documents_booking_id_kind_key" ON "booking_documents"("booking_id", "kind");

ALTER TABLE "booking_documents" ADD CONSTRAINT "booking_documents_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
