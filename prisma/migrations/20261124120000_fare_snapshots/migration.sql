-- Fares found by the daily fare-watch job, shown on the public fares board.
-- Additive only: safe for the release before it.
CREATE TABLE "fare_snapshots" (
    "id" UUID NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departure_date" DATE NOT NULL,
    "cabin" TEXT NOT NULL DEFAULT 'ECONOMY',
    "currency" TEXT NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "airline" TEXT NOT NULL DEFAULT '',
    "stops" INTEGER NOT NULL DEFAULT 0,
    "checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fare_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fare_snapshots_destination_checked_at_idx" ON "fare_snapshots"("destination", "checked_at");
CREATE INDEX "fare_snapshots_checked_at_idx" ON "fare_snapshots"("checked_at");
