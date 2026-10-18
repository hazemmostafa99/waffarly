ALTER TABLE "storefront_orders"
  ALTER COLUMN "customerName" DROP NOT NULL,
  ALTER COLUMN "customerPhone" DROP NOT NULL,
  ADD COLUMN "source" VARCHAR(16) NOT NULL DEFAULT 'storefront',
  ADD COLUMN "posShiftId" UUID,
  ADD COLUMN "createdByPosEmployeeId" UUID;

ALTER TABLE "storefront_orders"
  ADD CONSTRAINT "storefront_orders_posShiftId_merchantId_fkey"
    FOREIGN KEY ("posShiftId", "merchantId")
    REFERENCES "pos_shifts"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "storefront_orders_createdByPosEmployeeId_merchantId_fkey"
    FOREIGN KEY ("createdByPosEmployeeId", "merchantId")
    REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "storefront_orders_merchantId_source_createdAt_idx"
  ON "storefront_orders"("merchantId", "source", "createdAt");
CREATE INDEX "storefront_orders_merchantId_posShiftId_createdAt_idx"
  ON "storefront_orders"("merchantId", "posShiftId", "createdAt");

ALTER TABLE "storefront_order_lines"
  ADD COLUMN "note" VARCHAR(500),
  ADD COLUMN "stockRequirementsFrozenAt" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "storefront_order_lines_id_merchantId_key"
  ON "storefront_order_lines"("id", "merchantId");

CREATE TABLE "storefront_order_line_stock_requirements" (
  "id" UUID NOT NULL,
  "orderLineId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "stockItemName" VARCHAR(160) NOT NULL,
  "baseUnit" VARCHAR(16) NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "storefront_order_line_stock_requirements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storefront_order_line_stock_requirements_orderLineId_merchantId_fkey"
    FOREIGN KEY ("orderLineId", "merchantId")
    REFERENCES "storefront_order_lines"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "storefront_order_line_stock_requirements_stockItemId_merchantId_fkey"
    FOREIGN KEY ("stockItemId", "merchantId")
    REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "storefront_order_line_stock_requirements_quantity_check"
    CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "storefront_order_line_stock_requirements_orderLineId_position_key"
  ON "storefront_order_line_stock_requirements"("orderLineId", "position");
CREATE INDEX "storefront_order_line_stock_requirements_merchantId_stockItemId_idx"
  ON "storefront_order_line_stock_requirements"("merchantId", "stockItemId");
