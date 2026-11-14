-- Distance-banded transfer pricing, per passenger count.
CREATE TABLE "transfer_rates" (
    "id" UUID NOT NULL,
    "from_km" SMALLINT NOT NULL,
    "to_km" SMALLINT NOT NULL,
    "passengers" SMALLINT NOT NULL,
    "per_person_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transfer_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transfer_rates_from_km_to_km_passengers_key"
  ON "transfer_rates"("from_km", "to_km", "passengers");
CREATE INDEX "transfer_rates_is_active_from_km_idx"
  ON "transfer_rates"("is_active", "from_km");
