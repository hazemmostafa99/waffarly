ALTER TABLE "merchants" ADD COLUMN "storefrontSlug" VARCHAR(120);

UPDATE "merchants"
SET "storefrontSlug" =
  left(
    coalesce(
      nullif(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''),
      'store'
    ),
    80
  ) || '-' || replace("id"::text, '-', '');

ALTER TABLE "merchants" ALTER COLUMN "storefrontSlug" SET NOT NULL;

CREATE UNIQUE INDEX "merchants_storefrontSlug_key" ON "merchants"("storefrontSlug");

ALTER TABLE "merchants"
ADD CONSTRAINT "merchants_storefrontSlug_check"
CHECK ("storefrontSlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
