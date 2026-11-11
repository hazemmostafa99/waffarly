ALTER TABLE "storefront_orders" ADD COLUMN "requestId" UUID, ADD COLUMN "requestFingerprint" VARCHAR(64);
CREATE UNIQUE INDEX "storefront_orders_merchantId_requestId_key" ON "storefront_orders"("merchantId","requestId");
