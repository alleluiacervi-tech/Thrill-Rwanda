-- A provider may be approved for several categories, not just one.
ALTER TABLE "providers" ADD COLUMN "kinds" "ProviderKind"[] NOT NULL DEFAULT ARRAY[]::"ProviderKind"[];

-- Everyone keeps exactly what they already offer.
UPDATE "providers" SET "kinds" = ARRAY["kind"]::"ProviderKind"[] WHERE cardinality("kinds") = 0;
