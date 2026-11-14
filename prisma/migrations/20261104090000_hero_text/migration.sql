-- The paragraph under the homepage headline, editable in Admin -> Settings. Empty keeps the built-in text.
ALTER TABLE "site_settings" ADD COLUMN "hero_text" TEXT;
