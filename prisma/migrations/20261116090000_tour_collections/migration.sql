-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "collection" TEXT;

-- CreateIndex
CREATE INDEX "tours_collection_idx" ON "tours"("collection");
