ALTER TABLE "storefront_order_lines"
ADD COLUMN "recognizedRevenueAmount" DECIMAL(12,2),
ADD COLUMN "revenueRecognizedAt" TIMESTAMPTZ(6),
ADD COLUMN "costSnapshotTotal" DECIMAL(18,2),
ADD COLUMN "costSnapshotAt" TIMESTAMPTZ(6);

CREATE TABLE "storefront_order_line_cost_snapshots" (
  "id" UUID NOT NULL,
  "orderLineId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "stockItemName" VARCHAR(160) NOT NULL,
  "baseUnit" VARCHAR(16) NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "costRevision" INTEGER NOT NULL,
  "baseUnitCost" DECIMAL(38,12) NOT NULL,
  "extendedCost" DECIMAL(18,2) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "storefront_order_line_cost_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storefront_order_line_cost_snapshots_order_line_item_key" UNIQUE ("orderLineId", "stockItemId"),
  CONSTRAINT "storefront_order_line_cost_snapshots_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "storefront_order_line_cost_snapshots_revision_check" CHECK ("costRevision" > 0),
  CONSTRAINT "storefront_order_line_cost_snapshots_cost_check" CHECK ("baseUnitCost" > 0 AND "extendedCost" >= 0),
  CONSTRAINT "storefront_order_line_cost_snapshots_line_fkey"
    FOREIGN KEY ("orderLineId", "merchantId") REFERENCES "storefront_order_lines"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "storefront_order_line_cost_snapshots_item_fkey"
    FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "storefront_order_line_cost_snapshots_cost_event_fkey"
    FOREIGN KEY ("merchantId", "stockItemId", "costRevision") REFERENCES "stock_item_cost_events"("merchantId", "stockItemId", "revision") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "storefront_order_line_cost_snapshots_merchantId_stockItemId_createdAt_id_idx"
ON "storefront_order_line_cost_snapshots"("merchantId", "stockItemId", "createdAt", "id");
