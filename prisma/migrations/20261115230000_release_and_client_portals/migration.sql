-- AlterTable
ALTER TABLE "booking_documents" ADD COLUMN     "legal_hold_reason" TEXT;

-- CreateTable
CREATE TABLE "client_case_access" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "can_accept" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "client_case_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_accounts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "corporate_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_members" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "corporate_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_case_access" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "corporate_case_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_reviews" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "intent_key" UUID NOT NULL,
    "input_hash" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "review_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_records" (
    "environment" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT NOT NULL,
    "review_at" TIMESTAMPTZ NOT NULL,
    "cost_minor" INTEGER,
    "currency" TEXT,
    "renewal_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "release_records_pkey" PRIMARY KEY ("environment","key")
);

-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "name" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "succeeded_at" TIMESTAMPTZ,
    "error_code" TEXT,
    "processed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "whatsapp_consents" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "evidence" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,

    CONSTRAINT "whatsapp_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_case_access_enquiry_id_user_id_key" ON "client_case_access"("enquiry_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_members_account_id_user_id_key" ON "corporate_members"("account_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "corporate_case_access_account_id_enquiry_id_key" ON "corporate_case_access"("account_id", "enquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_reviews_intent_key_key" ON "supplier_reviews"("intent_key");

-- CreateIndex
CREATE INDEX "supplier_reviews_supplier_id_created_at_idx" ON "supplier_reviews"("supplier_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_consents_enquiry_id_key" ON "whatsapp_consents"("enquiry_id");

-- AddForeignKey
ALTER TABLE "client_case_access" ADD CONSTRAINT "client_case_access_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_case_access" ADD CONSTRAINT "client_case_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_members" ADD CONSTRAINT "corporate_members_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "corporate_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_members" ADD CONSTRAINT "corporate_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_case_access" ADD CONSTRAINT "corporate_case_access_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "corporate_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_case_access" ADD CONSTRAINT "corporate_case_access_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_reviews" ADD CONSTRAINT "supplier_reviews_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_consents" ADD CONSTRAINT "whatsapp_consents_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
