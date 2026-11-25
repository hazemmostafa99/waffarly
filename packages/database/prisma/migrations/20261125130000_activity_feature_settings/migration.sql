-- Super Admin feature switches per business activity.
-- Kitchen and dining tables exist only for restaurants; delivery is available to every activity.
ALTER TABLE "business_activities"
  ADD COLUMN "kitchenEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "diningTablesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Restaurant rows saved before this migration keep their existing kitchen and tables behavior.
UPDATE "business_activities"
SET "kitchenEnabled" = true, "diningTablesEnabled" = true
WHERE "key" = 'restaurant';

ALTER TABLE "business_activities"
  ADD CONSTRAINT "business_activities_restaurant_features_check"
  CHECK ("key" = 'restaurant' OR (NOT "kitchenEnabled" AND NOT "diningTablesEnabled"));
