-- Fares typed in by the desk: how long each stays on the board, and an optional deal line. Additive only.
ALTER TABLE "fare_snapshots" ADD COLUMN "valid_until" TIMESTAMPTZ;
ALTER TABLE "fare_snapshots" ADD COLUMN "deal_note" TEXT;
