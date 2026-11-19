CREATE TABLE "merchant_customer_addresses" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "merchantCustomerId" UUID NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "deliveryAreaId" VARCHAR(120) NOT NULL,
  "governorate" VARCHAR(80) NOT NULL,
  "locality" VARCHAR(120) NOT NULL,
  "area" VARCHAR(120) NOT NULL,
  "streetAddress" VARCHAR(500) NOT NULL,
  "notes" VARCHAR(500) NOT NULL DEFAULT '',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "merchant_customer_addresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "merchant_customer_addresses_merchantCustomerId_merchantId_fkey"
    FOREIGN KEY ("merchantCustomerId", "merchantId")
    REFERENCES "merchant_customers"("id", "merchantId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "merchant_customer_addresses_owner_created_idx"
  ON "merchant_customer_addresses"("merchantId", "merchantCustomerId", "createdAt", "id");

CREATE UNIQUE INDEX "merchant_customer_addresses_one_default_per_customer_key"
  ON "merchant_customer_addresses"("merchantId", "merchantCustomerId")
  WHERE "isDefault" = true;
