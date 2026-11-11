CREATE TABLE "restaurant_profiles" (
"merchantId" UUID PRIMARY KEY REFERENCES "merchants"("id") ON DELETE RESTRICT,
"description" VARCHAR(1000) NOT NULL DEFAULT '', "cuisines" TEXT[] NOT NULL DEFAULT '{}',
"logoImage" JSONB, "coverImage" JSONB, "published" BOOLEAN NOT NULL DEFAULT false,
"displayOrder" INTEGER NOT NULL DEFAULT 0, "timezone" VARCHAR(80) NOT NULL DEFAULT 'Africa/Cairo',
"alwaysOpen" BOOLEAN NOT NULL DEFAULT false, "openingHours" JSONB NOT NULL DEFAULT '[]',
"scheduleExceptions" JSONB NOT NULL DEFAULT '[]', "ordersPaused" BOOLEAN NOT NULL DEFAULT false,
"pauseReason" VARCHAR(500), "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true, "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
"deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0, "minimumDeliveryOrder" DECIMAL(12,2) NOT NULL DEFAULT 0,
"deliveryTimeMinMinutes" INTEGER NOT NULL DEFAULT 0, "deliveryTimeMaxMinutes" INTEGER NOT NULL DEFAULT 0,
"deliveryAreas" JSONB NOT NULL DEFAULT '[]', "referenceData" JSONB, "revision" INTEGER NOT NULL DEFAULT 1,
"updatedBy" VARCHAR(80) NOT NULL, "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "restaurant_money_bounds" CHECK ("deliveryFee" >= 0 AND "minimumDeliveryOrder" >= 0),
CONSTRAINT "restaurant_time_bounds" CHECK ("deliveryTimeMinMinutes" >= 0 AND "deliveryTimeMaxMinutes" >= "deliveryTimeMinMinutes")
);
CREATE INDEX "restaurant_profiles_published_displayOrder_merchantId_idx" ON "restaurant_profiles"("published","displayOrder","merchantId");
ALTER TABLE "categories" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "referenceKey" VARCHAR(160), ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "menuSectionId" UUID;
CREATE UNIQUE INDEX "products_referenceKey_key" ON "products"("referenceKey");
ALTER TABLE "products" ADD CONSTRAINT "products_menu_section_tenant" FOREIGN KEY ("menuSectionId","merchantId") REFERENCES "categories"("id","merchantId") ON DELETE RESTRICT;
