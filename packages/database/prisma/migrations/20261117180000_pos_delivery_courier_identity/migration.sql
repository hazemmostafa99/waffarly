ALTER TABLE "pos_deliveries"
  ADD COLUMN "courierId" UUID;

CREATE INDEX "pos_deliveries_merchantId_courierId_dispatchedAt_idx"
  ON "pos_deliveries"("merchantId", "courierId", "dispatchedAt");

ALTER TABLE "pos_deliveries"
  ADD CONSTRAINT "pos_deliveries_courierId_merchantId_fkey"
  FOREIGN KEY ("courierId", "merchantId")
  REFERENCES "delivery_couriers"("id", "merchantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
