CREATE TABLE "merchant_discounts" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(200) NOT NULL DEFAULT '',
    "code" VARCHAR(32) NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "minimum" DECIMAL(12,2) NOT NULL,
    "maximum" DECIMAL(12,2),
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "terms" VARCHAR(2000) NOT NULL DEFAULT '',
    "state" VARCHAR(16) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "creationRequest" UUID NOT NULL,
    "creationFingerprint" VARCHAR(64) NOT NULL,
    "createdBy" VARCHAR(80) NOT NULL,
    "updatedBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "merchant_discounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "merchant_discounts_type_check" CHECK ("type" IN ('percentage', 'fixed')),
    CONSTRAINT "merchant_discounts_state_check" CHECK ("state" IN ('published', 'draft', 'paused')),
    CONSTRAINT "merchant_discounts_value_check" CHECK ("value" > 0 AND ("type" != 'percentage' OR "value" <= 100)),
    CONSTRAINT "merchant_discounts_minimum_check" CHECK ("minimum" >= 0),
    CONSTRAINT "merchant_discounts_maximum_check" CHECK ("maximum" IS NULL OR "maximum" > 0),
    CONSTRAINT "merchant_discounts_fixed_maximum_check" CHECK ("type" = 'percentage' OR "maximum" IS NULL),
    CONSTRAINT "merchant_discounts_date_check" CHECK ("endDate" >= "startDate"),
    CONSTRAINT "merchant_discounts_usage_check" CHECK ("usageLimit" IS NULL OR "usageLimit" > 0),
    CONSTRAINT "merchant_discounts_count_check" CHECK ("usedCount" >= 0 AND ("usageLimit" IS NULL OR "usedCount" <= "usageLimit")),
    CONSTRAINT "merchant_discounts_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "merchant_discounts_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "merchant_discounts_id_merchantId_key" ON "merchant_discounts"("id", "merchantId");
CREATE UNIQUE INDEX "merchant_discounts_merchantId_code_key" ON "merchant_discounts"("merchantId", "code");
CREATE UNIQUE INDEX "merchant_discounts_merchantId_creationRequest_key" ON "merchant_discounts"("merchantId", "creationRequest");
CREATE INDEX "merchant_discounts_merchantId_createdAt_id_idx" ON "merchant_discounts"("merchantId", "createdAt", "id");

CREATE TABLE "merchant_discount_branches" (
    "merchantId" UUID NOT NULL,
    "discountId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    CONSTRAINT "merchant_discount_branches_pkey" PRIMARY KEY ("merchantId", "discountId", "branchId"),
    CONSTRAINT "merchant_discount_branches_discountId_merchantId_fkey" FOREIGN KEY ("discountId", "merchantId") REFERENCES "merchant_discounts"("id", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "merchant_discount_branches_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "merchant_discount_redemptions" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "discountId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "terms" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_discount_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "merchant_discount_redemptions_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "merchant_discount_redemptions_orderId_merchantId_key" UNIQUE ("orderId", "merchantId"),
    CONSTRAINT "merchant_discount_redemptions_discountId_merchantId_fkey" FOREIGN KEY ("discountId", "merchantId") REFERENCES "merchant_discounts"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "merchant_discount_redemptions_orderId_merchantId_fkey" FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "merchant_discount_redemptions_merchantId_discountId_idx" ON "merchant_discount_redemptions"("merchantId", "discountId");
