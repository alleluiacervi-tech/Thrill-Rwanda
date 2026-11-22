CREATE TABLE "airport_transfer_pricing" (
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "rates" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "airport_transfer_pricing_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "transfer_map_usage" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "transfer_map_usage_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "transfer_map_usage_expires_at_idx" ON "transfer_map_usage"("expires_at");
