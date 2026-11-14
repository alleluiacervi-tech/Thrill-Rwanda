-- CreateTable
CREATE TABLE "site_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "deposit_percent" SMALLINT NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);


-- One row only, and a deposit that is always a real share of the total.
ALTER TABLE "site_settings"
  ADD CONSTRAINT "site_settings_single_row" CHECK ("id" = 1),
  ADD CONSTRAINT "site_settings_deposit_range" CHECK ("deposit_percent" BETWEEN 1 AND 100);

-- Starts at the 30% the booking panel already advertised, so nothing changes until an admin decides.
INSERT INTO "site_settings" ("id", "deposit_percent", "updated_at") VALUES (1, 30, CURRENT_TIMESTAMP);
