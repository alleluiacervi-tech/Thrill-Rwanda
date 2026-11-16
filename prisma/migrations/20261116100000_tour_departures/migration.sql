-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "enquiry_only" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fixed_departures" BOOLEAN NOT NULL DEFAULT false;
-- CreateTable
CREATE TABLE "tour_departures" (
    "id" UUID NOT NULL,
    "tour_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tour_departures_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "tour_departures_starts_on_idx" ON "tour_departures"("starts_on");
-- CreateIndex
CREATE UNIQUE INDEX "tour_departures_tour_id_starts_on_key" ON "tour_departures"("tour_id", "starts_on");
-- AddForeignKey
ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
