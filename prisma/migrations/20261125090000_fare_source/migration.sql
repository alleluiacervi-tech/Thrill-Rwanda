-- Admin chooses where flight board prices come from; each stored fare records its source. Additive only.
ALTER TABLE "site_settings" ADD COLUMN "fare_source" TEXT NOT NULL DEFAULT 'off';
ALTER TABLE "fare_snapshots" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'duffel';
