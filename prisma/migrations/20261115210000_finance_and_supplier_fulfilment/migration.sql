-- CreateTable
CREATE TABLE "financial_cases" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "currency" TEXT NOT NULL,
    "customer_charge_minor" INTEGER NOT NULL,
    "service_fee_minor" INTEGER NOT NULL,
    "tax_reserve_minor" INTEGER NOT NULL,
    "required_funding_minor" INTEGER NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "review_evidence" TEXT,
    "instructions" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_accounts" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "approval_evidence" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_proofs" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "reference_key" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "party_key" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offsite_receipts" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "proof_id" UUID NOT NULL,
    "payer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reconciled_at" TIMESTAMPTZ,
    "reconciled_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offsite_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_allocations" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "escalation" TEXT NOT NULL,
    "service_area" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "limitations" TEXT NOT NULL,
    "commercial_terms" TEXT NOT NULL,
    "currencies" TEXT[],
    "agreement_evidence" TEXT NOT NULL,
    "performance_notes" TEXT NOT NULL DEFAULT '',
    "next_review_at" TIMESTAMPTZ,
    "publication_allowed" BOOLEAN NOT NULL DEFAULT false,
    "approved_wording" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_commitments" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "reference_key" TEXT NOT NULL,
    "contract_ref" TEXT NOT NULL,
    "cost_minor" INTEGER NOT NULL,
    "confirmation_ref" TEXT,
    "confirmed_at" TIMESTAMPTZ,
    "verified_by_id" UUID,
    "confirmation_evidence" TEXT,
    "evidence" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_refunds" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "reference_key" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_operations" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "intent_key" UUID NOT NULL,
    "input_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_entries" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "proof_id" UUID,
    "commitment_id" UUID,
    "refund_id" UUID,
    "allocation_id" UUID,
    "reference_key" TEXT,
    "reverses_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_fulfilments" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "commitment_id" UUID NOT NULL,
    "confirmation_ref" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "verified_by_id" UUID NOT NULL,
    "confirmed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "legacy_booking_id" UUID,

    CONSTRAINT "enquiry_fulfilments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_audits" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "intent_key" UUID NOT NULL,
    "input_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_cases_enquiry_id_key" ON "financial_cases"("enquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_cases_quote_id_key" ON "financial_cases"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_accounts_code_key" ON "settlement_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_proofs_account_id_reference_key_key" ON "settlement_proofs"("account_id", "reference_key");

-- CreateIndex
CREATE UNIQUE INDEX "offsite_receipts_proof_id_key" ON "offsite_receipts"("proof_id");

-- CreateIndex
CREATE INDEX "receipt_allocations_receipt_id_status_idx" ON "receipt_allocations"("receipt_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_commitments_case_id_supplier_id_reference_key_key" ON "supplier_commitments"("case_id", "supplier_id", "reference_key");

-- CreateIndex
CREATE UNIQUE INDEX "customer_refunds_case_id_reference_key_key" ON "customer_refunds"("case_id", "reference_key");

-- CreateIndex
CREATE UNIQUE INDEX "financial_operations_intent_key_key" ON "financial_operations"("intent_key");

-- CreateIndex
CREATE INDEX "financial_operations_case_id_created_at_idx" ON "financial_operations"("case_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_reference_key_key" ON "financial_entries"("reference_key");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_reverses_id_key" ON "financial_entries"("reverses_id");

-- CreateIndex
CREATE INDEX "financial_entries_case_id_created_at_idx" ON "financial_entries"("case_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_fulfilments_case_id_key" ON "enquiry_fulfilments"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_fulfilments_legacy_booking_id_key" ON "enquiry_fulfilments"("legacy_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "registry_audits_intent_key_key" ON "registry_audits"("intent_key");

-- CreateIndex
CREATE INDEX "registry_audits_entity_id_created_at_idx" ON "registry_audits"("entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "financial_cases" ADD CONSTRAINT "financial_cases_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_cases" ADD CONSTRAINT "financial_cases_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_proofs" ADD CONSTRAINT "settlement_proofs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_proofs" ADD CONSTRAINT "settlement_proofs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "settlement_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offsite_receipts" ADD CONSTRAINT "offsite_receipts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offsite_receipts" ADD CONSTRAINT "offsite_receipts_proof_id_fkey" FOREIGN KEY ("proof_id") REFERENCES "settlement_proofs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "offsite_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_commitments" ADD CONSTRAINT "supplier_commitments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_commitments" ADD CONSTRAINT "supplier_commitments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_proof_id_fkey" FOREIGN KEY ("proof_id") REFERENCES "settlement_proofs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "supplier_commitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "customer_refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "receipt_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "financial_entries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "enquiry_fulfilments" ADD CONSTRAINT "enquiry_fulfilments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "financial_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_fulfilments" ADD CONSTRAINT "enquiry_fulfilments_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "supplier_commitments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_fulfilments" ADD CONSTRAINT "enquiry_fulfilments_legacy_booking_id_fkey" FOREIGN KEY ("legacy_booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
