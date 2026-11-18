CREATE TABLE "delivery_courier_attempts" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "courierId" UUID NOT NULL,
  "courierName" VARCHAR(160) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'out_for_delivery',
  "dispatchedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  CONSTRAINT "delivery_courier_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_courier_attempts_status_check"
    CHECK ("status" IN ('out_for_delivery', 'delivered', 'failed'))
);

CREATE INDEX "delivery_courier_attempts_merchantId_courierId_dispatchedAt_idx"
  ON "delivery_courier_attempts"("merchantId", "courierId", "dispatchedAt");
CREATE INDEX "delivery_courier_attempts_merchantId_orderId_status_idx"
  ON "delivery_courier_attempts"("merchantId", "orderId", "status");

ALTER TABLE "delivery_courier_attempts"
  ADD CONSTRAINT "delivery_courier_attempts_orderId_merchantId_fkey"
  FOREIGN KEY ("orderId", "merchantId")
  REFERENCES "pos_deliveries"("orderId", "merchantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_courier_attempts"
  ADD CONSTRAINT "delivery_courier_attempts_courierId_merchantId_fkey"
  FOREIGN KEY ("courierId", "merchantId")
  REFERENCES "delivery_couriers"("id", "merchantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
