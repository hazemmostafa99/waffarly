CREATE TABLE "stock_item_cost_current" (
  "merchantId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "baseUnitCost" DECIMAL(38,12) NOT NULL,
  "sourceType" VARCHAR(16) NOT NULL,
  "sourceInvoiceId" UUID,
  "sourceInvoiceNumber" VARCHAR(100),
  "supplierName" VARCHAR(160),
  "sourceWarehouseId" UUID,
  "sourceWarehouseName" VARCHAR(160),
  "enteredUnitCode" VARCHAR(32) NOT NULL,
  "enteredUnitName" VARCHAR(80) NOT NULL,
  "enteredUnitCost" DECIMAL(18,2) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedBy" VARCHAR(80) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_item_cost_current_pkey" PRIMARY KEY ("merchantId", "stockItemId"),
  CONSTRAINT "stock_item_cost_current_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_cost_current_stockItemId_merchantId_fkey" FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_cost_current_sourceInvoiceId_merchantId_fkey" FOREIGN KEY ("sourceInvoiceId", "merchantId") REFERENCES "purchase_invoices"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_cost_current_sourceWarehouseId_merchantId_fkey" FOREIGN KEY ("sourceWarehouseId", "merchantId") REFERENCES "warehouses"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_cost_current_sourceType_check" CHECK (
    ("sourceType" = 'opening' AND "sourceInvoiceId" IS NULL AND "supplierName" IS NULL AND "sourceWarehouseId" IS NULL AND "sourceWarehouseName" IS NULL)
    OR ("sourceType" = 'purchase' AND "sourceInvoiceId" IS NOT NULL AND "supplierName" IS NOT NULL AND "sourceWarehouseId" IS NOT NULL AND "sourceWarehouseName" IS NOT NULL)
  ),
  CONSTRAINT "stock_item_cost_current_positive_cost_check" CHECK ("baseUnitCost" > 0 AND "enteredUnitCost" > 0),
  CONSTRAINT "stock_item_cost_current_revision_check" CHECK ("revision" > 0)
);

CREATE TABLE "stock_item_cost_events" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "requestId" UUID NOT NULL,
  "requestFingerprint" VARCHAR(64) NOT NULL,
  "baseUnitCost" DECIMAL(38,12) NOT NULL,
  "sourceType" VARCHAR(16) NOT NULL,
  "sourceInvoiceId" UUID,
  "sourceInvoiceNumber" VARCHAR(100),
  "supplierName" VARCHAR(160),
  "sourceWarehouseId" UUID,
  "sourceWarehouseName" VARCHAR(160),
  "enteredUnitCode" VARCHAR(32) NOT NULL,
  "enteredUnitName" VARCHAR(80) NOT NULL,
  "enteredUnitCost" DECIMAL(18,2) NOT NULL,
  "reason" VARCHAR(500),
  "actor" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_item_cost_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_item_cost_events_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_cost_events_stockItemId_merchantId_fkey" FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_cost_events_sourceInvoiceId_merchantId_fkey" FOREIGN KEY ("sourceInvoiceId", "merchantId") REFERENCES "purchase_invoices"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_cost_events_sourceWarehouseId_merchantId_fkey" FOREIGN KEY ("sourceWarehouseId", "merchantId") REFERENCES "warehouses"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_cost_events_sourceType_check" CHECK (
    ("sourceType" = 'opening' AND "sourceInvoiceId" IS NULL AND "supplierName" IS NULL AND "sourceWarehouseId" IS NULL AND "sourceWarehouseName" IS NULL AND "reason" IS NOT NULL)
    OR ("sourceType" = 'purchase' AND "sourceInvoiceId" IS NOT NULL AND "supplierName" IS NOT NULL AND "sourceWarehouseId" IS NOT NULL AND "sourceWarehouseName" IS NOT NULL AND "reason" IS NULL)
  ),
  CONSTRAINT "stock_item_cost_events_positive_cost_check" CHECK ("baseUnitCost" > 0 AND "enteredUnitCost" > 0),
  CONSTRAINT "stock_item_cost_events_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "stock_item_cost_events_reason_check" CHECK ("reason" IS NULL OR length(btrim("reason")) >= 3)
);

CREATE UNIQUE INDEX "stock_item_cost_current_stockItemId_merchantId_key"
  ON "stock_item_cost_current"("stockItemId", "merchantId");

CREATE UNIQUE INDEX "stock_item_cost_events_merchantId_stockItemId_revision_key"
  ON "stock_item_cost_events"("merchantId", "stockItemId", "revision");
CREATE UNIQUE INDEX "stock_item_cost_events_merchantId_stockItemId_requestId_key"
  ON "stock_item_cost_events"("merchantId", "stockItemId", "requestId");
CREATE INDEX "stock_item_cost_events_merchantId_stockItemId_createdAt_id_idx"
  ON "stock_item_cost_events"("merchantId", "stockItemId", "createdAt", "id");
