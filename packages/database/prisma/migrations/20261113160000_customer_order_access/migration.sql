CREATE TABLE "customer_order_access" (
  "orderId" UUID PRIMARY KEY, "merchantId" UUID NOT NULL, "accountId" UUID,
  "guestHash" VARCHAR(64), "guestExpiresAt" TIMESTAMPTZ(6), "claimedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_order_access_order_fk" FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT,
  CONSTRAINT "customer_order_access_account_fk" FOREIGN KEY ("accountId") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT,
  CONSTRAINT "customer_order_access_identity" CHECK (
    ("accountId" IS NOT NULL AND "guestHash" IS NULL AND "guestExpiresAt" IS NULL) OR
    ("accountId" IS NULL AND "guestHash" IS NOT NULL AND "guestExpiresAt" IS NOT NULL))
);
CREATE INDEX "customer_order_access_accountId_createdAt_orderId_idx" ON "customer_order_access"("accountId", "createdAt", "orderId");
CREATE INDEX "customer_order_access_guestHash_createdAt_orderId_idx" ON "customer_order_access"("guestHash", "createdAt", "orderId");
