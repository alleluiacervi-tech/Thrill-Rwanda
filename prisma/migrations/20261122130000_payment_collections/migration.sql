ALTER TABLE "payments" ADD COLUMN "gateway" TEXT NOT NULL DEFAULT 'PESAPAL';
ALTER TYPE "PaymentMethod" ADD VALUE 'MTN_MOMO';
ALTER TYPE "PaymentMethod" ADD VALUE 'AIRTEL_MONEY';

CREATE TABLE "payment_invoices" (
  "id" UUID PRIMARY KEY,
  "number" TEXT NOT NULL UNIQUE,
  "booking_id" UUID UNIQUE REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "case_id" UUID UNIQUE REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "currency" TEXT NOT NULL,
  "total_minor" INTEGER NOT NULL CHECK ("total_minor" > 0),
  "deposit_minor" INTEGER NOT NULL CHECK ("deposit_minor" BETWEEN 1 AND "total_minor"),
  "due_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (num_nonnulls("booking_id", "case_id") = 1)
);

CREATE TABLE "payment_links" (
  "invoice_id" UUID PRIMARY KEY REFERENCES "payment_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "token_hash" TEXT NOT NULL UNIQUE,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ
);

CREATE TABLE "collection_attempts" (
  "id" UUID PRIMARY KEY,
  "invoice_id" UUID NOT NULL REFERENCES "payment_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "provider" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "merchant_code" TEXT NOT NULL,
  "service_code" TEXT NOT NULL,
  "merchant_reference" UUID NOT NULL UNIQUE,
  "provider_reference" TEXT,
  "method" TEXT NOT NULL,
  "amount_minor" INTEGER NOT NULL CHECK ("amount_minor" > 0),
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('CREATED','INITIATED','PENDING','REQUIRES_ACTION','SUCCESSFUL','FAILED','EXPIRED','CANCELLED','RECONCILIATION_REQUIRED','PARTIALLY_REFUNDED','REFUNDED','DISPUTED')),
  "settlement_status" TEXT NOT NULL DEFAULT 'UNRECONCILED',
  "hosted_url" TEXT,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "next_check_at" TIMESTAMPTZ NOT NULL,
  "verified_at" TIMESTAMPTZ,
  "settled_at" TIMESTAMPTZ,
  "settlement_reference" TEXT UNIQUE,
  "settlement_evidence" TEXT,
  "settled_by_id" UUID,
  "fee_minor" INTEGER CHECK ("fee_minor" BETWEEN 0 AND "amount_minor"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "collection_attempts_provider_ref_key"
  ON "collection_attempts"("provider","environment","merchant_code","provider_reference");
CREATE UNIQUE INDEX "collection_attempts_one_open_per_invoice" ON "collection_attempts"("invoice_id")
  WHERE "status" IN ('CREATED','INITIATED','PENDING','REQUIRES_ACTION','RECONCILIATION_REQUIRED');
CREATE INDEX "collection_attempts_invoice_id_created_at_idx" ON "collection_attempts"("invoice_id","created_at");
CREATE INDEX "collection_attempts_environment_status_next_check_at_idx" ON "collection_attempts"("environment","status","next_check_at");

CREATE TABLE "collection_events" (
  "id" UUID PRIMARY KEY,
  "attempt_id" UUID NOT NULL REFERENCES "collection_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "dedupe_key" TEXT NOT NULL UNIQUE,
  "kind" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION "collection_events_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Payment collection events are append-only';
END;
$$;
CREATE TRIGGER "collection_events_append_only" BEFORE UPDATE OR DELETE ON "collection_events"
FOR EACH ROW EXECUTE FUNCTION "collection_events_append_only"();
CREATE TRIGGER "collection_events_no_truncate" BEFORE TRUNCATE ON "collection_events"
FOR EACH STATEMENT EXECUTE FUNCTION "collection_events_append_only"();

CREATE TABLE "payment_routing_policies" (
  "environment" TEXT PRIMARY KEY CHECK ("environment" IN ('staging','live')),
  "version" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "methods" TEXT[] NOT NULL,
  "min_minor" INTEGER NOT NULL CHECK ("min_minor" > 0),
  "max_minor" INTEGER NOT NULL CHECK ("max_minor" >= "min_minor"),
  "evidence" TEXT NOT NULL,
  "fee_terms" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL
);
