CREATE TABLE "stock_reorder_thresholds" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "minimumAvailableQuantity" DECIMAL(18,6) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_reorder_thresholds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_reorder_thresholds_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_reorder_thresholds_warehouseId_merchantId_fkey"
    FOREIGN KEY ("warehouseId", "merchantId") REFERENCES "warehouses"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_reorder_thresholds_stockItemId_merchantId_fkey"
    FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_reorder_thresholds_minimumAvailableQuantity_check"
    CHECK ("minimumAvailableQuantity" >= 0),
  CONSTRAINT "stock_reorder_thresholds_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "stock_reorder_thresholds_id_merchantId_key"
  ON "stock_reorder_thresholds"("id", "merchantId");
CREATE UNIQUE INDEX "stock_reorder_thresholds_merchantId_warehouseId_stockItemId_key"
  ON "stock_reorder_thresholds"("merchantId", "warehouseId", "stockItemId");
CREATE INDEX "stock_reorder_thresholds_merchantId_warehouseId_createdAt_id_idx"
  ON "stock_reorder_thresholds"("merchantId", "warehouseId", "createdAt", "id");
