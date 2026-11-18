ALTER TABLE "auth_sessions"
  ALTER COLUMN "subjectKind" TYPE VARCHAR(24);

CREATE TABLE "merchant_customer_credentials" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "merchantCustomerId" UUID NOT NULL,
  "phone" VARCHAR(16) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_customer_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_customer_credentials_merchantCustomerId_merchantId_key"
  ON "merchant_customer_credentials"("merchantCustomerId", "merchantId");
CREATE UNIQUE INDEX "merchant_customer_credentials_merchantId_phone_key"
  ON "merchant_customer_credentials"("merchantId", "phone");
CREATE UNIQUE INDEX "merchant_customer_credentials_merchantId_email_key"
  ON "merchant_customer_credentials"("merchantId", "email");

ALTER TABLE "merchant_customer_credentials"
  ADD CONSTRAINT "merchant_customer_credentials_merchantCustomerId_merchantId_fkey"
  FOREIGN KEY ("merchantCustomerId", "merchantId")
  REFERENCES "merchant_customers"("id", "merchantId")
  ON DELETE CASCADE ON UPDATE CASCADE;
