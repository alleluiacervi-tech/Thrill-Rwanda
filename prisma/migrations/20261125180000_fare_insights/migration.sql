-- Small fetched facts for the flights page (popular destinations from Kigali). Additive only.
CREATE TABLE "fare_insights" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "fare_insights_pkey" PRIMARY KEY ("key")
);
