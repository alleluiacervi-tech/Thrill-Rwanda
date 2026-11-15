-- AlterTable
ALTER TABLE "booking_documents" ADD COLUMN     "expires_at" TIMESTAMPTZ,
ADD COLUMN     "retention_purpose" TEXT;
