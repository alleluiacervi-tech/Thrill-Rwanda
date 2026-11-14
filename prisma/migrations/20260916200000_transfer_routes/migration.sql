-- CreateEnum
CREATE TYPE "TransferMode" AS ENUM ('AIRPORT', 'RAIL', 'ROAD');

-- CreateTable
CREATE TABLE "transfer_routes" (
    "id" UUID NOT NULL,
    "from_place" TEXT NOT NULL,
    "to_place" TEXT NOT NULL,
    "mode" "TransferMode" NOT NULL DEFAULT 'AIRPORT',
    "minutes" SMALLINT NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transfer_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transfer_routes_is_active_sort_order_idx" ON "transfer_routes"("is_active", "sort_order");


-- A route with no price or no travel time is a typo, not a route.
ALTER TABLE "transfer_routes"
  ADD CONSTRAINT "transfer_routes_price_positive" CHECK ("price_minor" > 0),
  ADD CONSTRAINT "transfer_routes_minutes_positive" CHECK ("minutes" > 0);

-- Carry over the routes the site was already showing, so /transfers is never empty after deploy.
-- These are placeholder prices from the original build: review them in Admin -> Transfer routes.
INSERT INTO "transfer_routes" ("id", "from_place", "to_place", "mode", "minutes", "price_minor", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'JKIA (Terminal 1A–1E)',       'Nairobi CBD',           'AIRPORT', 35,  350000,  10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'JKIA',                        'Westlands / Parklands', 'AIRPORT', 45,  420000,  20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'JKIA',                        'Karen / Langata',       'AIRPORT', 50,  480000,  30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Wilson Airport',              'Nairobi CBD',           'AIRPORT', 25,  300000,  40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Nairobi Terminus (SGR)',      'Nairobi CBD',           'RAIL',    40,  380000,  50, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Mombasa Terminus (SGR)',      'Diani Beach',           'RAIL',    90,  850000,  60, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Moi International (Mombasa)', 'Nyali / Bamburi',       'AIRPORT', 30,  320000,  70, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'JKIA',                        'Naivasha',              'ROAD',    150, 1200000, 80, CURRENT_TIMESTAMP);
