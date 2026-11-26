-- Online flight booking settings. Additive; online booking stays off by default.
ALTER TABLE "site_settings" ADD COLUMN "flight_online" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "site_settings" ADD COLUMN "flight_usd_rwf" INTEGER;
ALTER TABLE "site_settings" ADD COLUMN "flight_rate_set_at" TIMESTAMPTZ;
ALTER TABLE "site_settings" ADD COLUMN "flight_fx_buffer_percent" SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE "site_settings" ADD COLUMN "flight_fee_rwf" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "site_settings" ADD COLUMN "flight_owner_id" UUID;
