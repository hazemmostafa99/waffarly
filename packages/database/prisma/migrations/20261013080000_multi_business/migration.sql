ALTER TABLE "merchants" ADD COLUMN "activity" VARCHAR(32) NOT NULL DEFAULT 'restaurant';
ALTER TABLE "merchant_applications" ADD COLUMN "activity" VARCHAR(32) NOT NULL DEFAULT 'restaurant';
ALTER TABLE "merchants" ALTER COLUMN "activity" SET DEFAULT 'other';
ALTER TABLE "merchant_applications" ALTER COLUMN "activity" SET DEFAULT 'other';
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_activity_check" CHECK ("activity" IN ('restaurant', 'clothing', 'supermarket', 'other'));
ALTER TABLE "merchant_applications" ADD CONSTRAINT "merchant_applications_activity_check" CHECK ("activity" IN ('restaurant', 'clothing', 'supermarket', 'other'));
ALTER TABLE "business_activities" DROP CONSTRAINT "business_activities_key_check";
ALTER TABLE "business_activities" ADD CONSTRAINT "business_activities_key_check" CHECK ("key" IN ('restaurant', 'clothing', 'supermarket', 'other'));
ALTER TABLE "storefront_templates" DROP CONSTRAINT "storefront_templates_activity_check";
ALTER TABLE "storefront_templates" ADD CONSTRAINT "storefront_templates_activity_check" CHECK ("activity" IN ('general', 'restaurant', 'clothing', 'supermarket', 'other'));

INSERT INTO "storefront_templates" ("id", "key", "name", "description", "activity", "layout", "accentColor", "status", "revision", "updatedBy", "createdAt", "updatedAt") VALUES
('fe4a9000-0000-4000-8000-000000000001', 'everyday-catalog', 'Everyday Catalog', 'A clear catalog layout for products and services.', 'general', 'menu', '#315B43', 'available', 1, 'Waffarly', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('fe4a9000-0000-4000-8000-000000000002', 'brand-welcome', 'Brand Welcome', 'A welcoming storefront that puts your business identity first.', 'general', 'hero', '#A25A3C', 'available', 1, 'Waffarly', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
