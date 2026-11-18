ALTER TABLE "merchant_storefronts"
ADD COLUMN "layout" VARCHAR(16) NOT NULL DEFAULT 'hero';

UPDATE "merchant_storefronts" AS storefront
SET "layout" = template."layout"
FROM "storefront_templates" AS template
WHERE storefront."templateId" = template."id";

ALTER TABLE "merchant_storefronts"
ADD CONSTRAINT "merchant_storefronts_layout_check"
CHECK ("layout" IN ('menu', 'hero'));

ALTER TABLE "merchant_storefronts"
DROP CONSTRAINT "merchant_storefronts_templateId_fkey";

DROP INDEX "merchant_storefronts_templateId_idx";

ALTER TABLE "merchant_storefronts"
DROP COLUMN "templateId";

DROP TABLE "storefront_templates";

ALTER TABLE "business_activities"
DROP CONSTRAINT "business_activities_modules_check";

ALTER TABLE "business_activities"
DROP COLUMN "moduleKeys";

DROP TABLE "platform_modules";
