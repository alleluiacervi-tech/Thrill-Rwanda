-- The homepage headline's two lines, editable in Admin -> Settings. Empty keeps the built-in wording.
ALTER TABLE "site_settings" ADD COLUMN "hero_title" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "hero_subtitle" TEXT;
