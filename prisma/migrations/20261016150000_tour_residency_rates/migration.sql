-- Safari pricing by residency: citizens, East African residents, everyone else.
-- price_minor stays the citizen rate, so existing tours keep their price.
ALTER TABLE "tours" ADD COLUMN "price_resident_minor" INTEGER;
ALTER TABLE "tours" ADD COLUMN "price_non_resident_minor" INTEGER;
