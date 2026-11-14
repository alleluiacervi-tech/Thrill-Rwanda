-- CreateEnum
CREATE TYPE "TransferOrigin" AS ENUM ('NAIROBI', 'MOI_AIRPORT', 'MOMBASA_SGR', 'COAST_TOWNS');

-- CreateTable
CREATE TABLE "transfer_zones" (
    "id" UUID NOT NULL,
    "origin" "TransferOrigin" NOT NULL,
    "name" TEXT NOT NULL,
    "areas" TEXT NOT NULL,
    "distance" TEXT,
    "sedan_minor" INTEGER NOT NULL,
    "van_minor" INTEGER NOT NULL,
    "premium_minor" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transfer_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transfer_zones_origin_is_active_sort_order_idx" ON "transfer_zones"("origin", "is_active", "sort_order");

-- A zone without a price for every vehicle is a typo, not a zone.
ALTER TABLE "transfer_zones"
  ADD CONSTRAINT "transfer_zones_prices_positive" CHECK ("sedan_minor" > 0 AND "van_minor" > 0 AND "premium_minor" > 0);

-- The client's zone sheets (October 2026), so /transfers prices from day one. Amounts in cents.
INSERT INTO "transfer_zones" ("id", "origin", "name", "areas", "distance", "sedan_minor", "van_minor", "premium_minor", "sort_order", "updated_at") VALUES
  -- Nairobi, from JKIA
  (gen_random_uuid(), 'NAIROBI', 'Zone 1 · Near JKIA', 'JKIA, Embakasi, Pipeline, Fedha, Tassia, Nyayo, Syokimau, Katani, Mlolongo', '5–12 km', 400000, 650000, 900000, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NAIROBI', 'Zone 2 · Central Nairobi', 'CBD, Upper Hill, South B, South C, Industrial Area, Thika Road Mall (TRM), Roysambu, Kasarani, Mirema, Zimmerman, Githurai 44, Githurai 45, Pangani, Muthaiga, Eastleigh', '15–18 km', 500000, 750000, 1050000, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NAIROBI', 'Zone 3 · West & North', 'Westlands, Parklands, Gigiri, Lavington, Kilimani, Kileleshwa, Runda, Kiambu Road, Kahawa Sukari, Ruiru', '18–25 km', 600000, 900000, 1200000, 30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NAIROBI', 'Zone 4 · South-west & far east', 'Karen, Langata, Hardy, Kitisuru, Uthiru, Kikuyu, Ruaka, Kiambu Town, Kitengela, Athi River, Ongata Rongai, Loresho, Wilson Airport', '25–35 km', 750000, 1100000, 1500000, 40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NAIROBI', 'Zone 5 · Outskirts', 'Thika, Limuru, Tigoni, Kajiado, Ngong, Juja, Gatundu, Machakos Town', '40–60 km', 1000000, 1500000, 2000000, 50, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NAIROBI', 'Zone 6 · Upcountry', 'Naivasha', NULL, 1800000, 2600000, 3500000, 60, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NAIROBI', 'Zone 6 · Upcountry', 'Nakuru', NULL, 2200000, 3200000, 4500000, 61, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NAIROBI', 'Zone 6 · Upcountry', 'Nanyuki', NULL, 2800000, 4000000, 5500000, 62, CURRENT_TIMESTAMP),
  -- Mombasa, from Moi International Airport
  (gen_random_uuid(), 'MOI_AIRPORT', 'Zone A', 'Tudor, Kizingo, Nyali Bridge', '8 km', 400000, 650000, 900000, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOI_AIRPORT', 'Zone A', 'Nyali, Mkomani, Kongowea', '10 km', 450000, 700000, 950000, 11, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOI_AIRPORT', 'Zone A', 'Mombasa CBD, Old Town', '12 km', 450000, 700000, 950000, 12, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOI_AIRPORT', 'Zone A', 'Bamburi, Shanzu, Mtwapa', '14 km', 550000, 800000, 1100000, 13, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOI_AIRPORT', 'Zone B', 'Diani, Ukunda, Tiwi', '35 km + ferry', 1400000, 1800000, 2500000, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOI_AIRPORT', 'Zone B', 'Kilifi Town, Watamu', '60–110 km', 1200000, 1800000, 2600000, 21, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOI_AIRPORT', 'Zone B', 'Malindi', '120 km', 1800000, 2600000, 3500000, 22, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOI_AIRPORT', 'Zone B', 'Lamu', NULL, 2500000, 3500000, 5000000, 23, CURRENT_TIMESTAMP),
  -- Mombasa, from the SGR terminus at Miritini
  (gen_random_uuid(), 'MOMBASA_SGR', 'Zone A', 'Mombasa CBD, Nyali, Bamburi', '15–25 km', 500000, 750000, 1050000, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOMBASA_SGR', 'Zone A', 'Mtwapa, Shanzu', '28 km', 650000, 900000, 1200000, 11, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOMBASA_SGR', 'Zone B', 'Diani, Ukunda, Tiwi', '45 km + ferry', 1400000, 1800000, 2500000, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOMBASA_SGR', 'Zone B', 'Kilifi', '70 km', 1300000, 1900000, 2700000, 21, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOMBASA_SGR', 'Zone B', 'Watamu, Malindi', '120–140 km', 1800000, 2600000, 3500000, 22, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MOMBASA_SGR', 'Zone B', 'Voi, Tsavo', '160 km', 2000000, 3000000, 4200000, 23, CURRENT_TIMESTAMP),
  -- Coast, point to point
  (gen_random_uuid(), 'COAST_TOWNS', 'Between towns', 'Moi Airport ↔ SGR Mombasa', '20 km', 500000, 750000, 1000000, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'COAST_TOWNS', 'Between towns', 'Mombasa CBD ↔ Diani Beach', '35 km + ferry', 1200000, 1600000, 2200000, 11, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'COAST_TOWNS', 'Between towns', 'Nyali ↔ Diani', '40 km + ferry', 1300000, 1700000, 2300000, 12, CURRENT_TIMESTAMP);
