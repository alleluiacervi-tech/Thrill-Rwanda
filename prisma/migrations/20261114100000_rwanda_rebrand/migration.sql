-- Rwanda rebrand: USD pricing, Rwanda transfer zones, and Rwanda names for
-- the internal transfer keys.

-- Transfer price-list keys (the enum is only used by transfer_zones).
ALTER TYPE "TransferOrigin" RENAME VALUE 'NAIROBI' TO 'KIGALI';
ALTER TYPE "TransferOrigin" RENAME VALUE 'MOI_AIRPORT' TO 'MUSANZE';
ALTER TYPE "TransferOrigin" RENAME VALUE 'MOMBASA_SGR' TO 'RUBAVU';
ALTER TYPE "TransferOrigin" RENAME VALUE 'COAST_TOWNS' TO 'BETWEEN_TOWNS';

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'currency' AND column_default LIKE '%KES%'
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT ''USD''', r.table_name, r.column_name);
  END LOOP;
END $$;

DELETE FROM "transfer_zones";

INSERT INTO "transfer_zones" ("id", "origin", "name", "areas", "distance", "sedan_minor", "van_minor", "premium_minor", "sort_order", "updated_at") VALUES
  -- Kigali, from Kigali International Airport / Nyabugogo (amounts in US cents)
  (gen_random_uuid(), 'KIGALI', 'Zone 1 · Near the airport', 'Kigali Airport, Kanombe, Nyarugunga, Remera, Kimironko, Kicukiro', '3-10 km', 1500, 2500, 3500, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'KIGALI', 'Zone 2 · Central Kigali', 'City Centre, Nyarugenge, Kiyovu, Kacyiru, Kimihurura, Gisozi, Nyabugogo, Gikondo', '10-15 km', 2500, 4000, 5500, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'KIGALI', 'Zone 3 · Outer Kigali', 'Gahanga, Masaka, Kinyinya, Rusororo, Jabana, Shyorongi', '15-30 km', 3500, 5000, 7000, 30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'KIGALI', 'Zone 4 · Upcountry', 'Musanze (Volcanoes)', '95 km', 12000, 15000, 20000, 40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'KIGALI', 'Zone 4 · Upcountry', 'Akagera National Park', '110 km', 13000, 17000, 23000, 41, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'KIGALI', 'Zone 4 · Upcountry', 'Huye (Butare)', '135 km', 11000, 14000, 19000, 42, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'KIGALI', 'Zone 4 · Upcountry', 'Rubavu (Lake Kivu)', '155 km', 18000, 22000, 30000, 43, CURRENT_TIMESTAMP),
  -- Musanze, from the town
  (gen_random_uuid(), 'MUSANZE', 'Zone A', 'Musanze town, Kinigi, Volcanoes National Park HQ', '5-15 km', 2000, 3000, 4500, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MUSANZE', 'Zone B', 'Rubavu (Lake Kivu)', '65 km', 7000, 10000, 14000, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MUSANZE', 'Zone B', 'Kigali city', '95 km', 12000, 15000, 20000, 21, CURRENT_TIMESTAMP),
  -- Rubavu, from Lake Kivu
  (gen_random_uuid(), 'RUBAVU', 'Zone A', 'Rubavu town, Gisenyi, Nyamyumba', '3-15 km', 1500, 2500, 3500, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'RUBAVU', 'Zone B', 'Musanze (Volcanoes)', '65 km', 7000, 10000, 14000, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'RUBAVU', 'Zone B', 'Kigali city', '155 km', 18000, 22000, 30000, 21, CURRENT_TIMESTAMP),
  -- Between towns (point to point)
  (gen_random_uuid(), 'BETWEEN_TOWNS', 'Town routes', 'Kigali ↔ Musanze', NULL, 12000, 15000, 20000, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BETWEEN_TOWNS', 'Town routes', 'Kigali ↔ Rubavu', NULL, 18000, 22000, 30000, 11, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BETWEEN_TOWNS', 'Town routes', 'Musanze ↔ Rubavu', NULL, 7000, 10000, 14000, 12, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BETWEEN_TOWNS', 'Town routes', 'Kigali ↔ Huye', NULL, 11000, 14000, 19000, 13, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BETWEEN_TOWNS', 'Town routes', 'Kigali ↔ Akagera National Park', NULL, 13000, 17000, 23000, 14, CURRENT_TIMESTAMP);

-- Contact details: replace the previous contact number, email and address with Thrill Rwanda's.
UPDATE "site_settings"
  SET "phone" = '+250 786 261 104',
      "phone_alt" = NULL,
      "whatsapp" = '+250 786 261 104',
      "email" = 'info@thrillrwanda.com',
      "address" = 'Kigali, Rwanda';
