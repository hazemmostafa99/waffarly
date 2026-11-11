CREATE TABLE "customer_accounts" (
  "id" UUID NOT NULL,
  "phone" VARCHAR(16) NOT NULL,
  "phoneVerifiedAt" TIMESTAMPTZ(6) NOT NULL,
  "displayName" VARCHAR(120),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_accounts_phone_e164" CHECK ("phone" ~ '^\+[1-9][0-9]{6,14}$')
);
CREATE UNIQUE INDEX "customer_accounts_phone_key" ON "customer_accounts"("phone");

CREATE TABLE "merchant_customers" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "accountId" UUID,
  "name" VARCHAR(120) NOT NULL,
  "phone" VARCHAR(32),
  "email" VARCHAR(254),
  "notes" VARCHAR(2000) NOT NULL DEFAULT '',
  "segment" VARCHAR(16) NOT NULL DEFAULT 'regular',
  "firstChannel" VARCHAR(16) NOT NULL DEFAULT 'manual',
  "archivedAt" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "creationRequest" UUID NOT NULL,
  "creationFingerprint" VARCHAR(64) NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "merchant_customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "merchant_customers_segment_check" CHECK ("segment" IN ('regular', 'vip')),
  CONSTRAINT "merchant_customers_channel_check" CHECK ("firstChannel" IN ('marketplace', 'storefront', 'pos', 'manual')),
  CONSTRAINT "merchant_customers_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "merchant_customers_name_check" CHECK (length(trim("name")) > 0),
  CONSTRAINT "merchant_customers_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "merchant_customers_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "merchant_customers_id_merchantId_key" ON "merchant_customers"("id", "merchantId");
CREATE UNIQUE INDEX "merchant_customers_merchantId_accountId_key" ON "merchant_customers"("merchantId", "accountId");
CREATE UNIQUE INDEX "merchant_customers_merchantId_creationRequest_key" ON "merchant_customers"("merchantId", "creationRequest");
CREATE INDEX "merchant_customers_merchantId_createdAt_id_idx" ON "merchant_customers"("merchantId", "createdAt", "id");
CREATE INDEX "merchant_customers_merchantId_phone_idx" ON "merchant_customers"("merchantId", "phone");

ALTER TABLE "storefront_orders"
  ADD COLUMN "merchantCustomerId" UUID,
  ADD COLUMN "customerLinkedBy" VARCHAR(80),
  ADD COLUMN "customerLinkedAt" TIMESTAMPTZ(6),
  ADD CONSTRAINT "storefront_orders_merchantCustomerId_merchantId_fkey"
    FOREIGN KEY ("merchantCustomerId", "merchantId") REFERENCES "merchant_customers"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "storefront_orders_merchantId_merchantCustomerId_createdAt_idx" ON "storefront_orders"("merchantId", "merchantCustomerId", "createdAt");
