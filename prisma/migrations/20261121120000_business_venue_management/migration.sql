CREATE TABLE "business_venues" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "image" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "business_venues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_venue_spaces" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacities" JSONB NOT NULL,
    "maximum" INTEGER,
    "features" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "business_venue_spaces_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "business_venue_spaces_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "business_venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "business_venues_slug_key" ON "business_venues"("slug");
CREATE UNIQUE INDEX "business_venue_spaces_venue_id_name_key" ON "business_venue_spaces"("venue_id", "name");
