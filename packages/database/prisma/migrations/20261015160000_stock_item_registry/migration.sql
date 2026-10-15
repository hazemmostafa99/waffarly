CREATE TABLE "stock_items" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "creationRequest" UUID NOT NULL,
  "creationFingerprint" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "baseUnit" VARCHAR(16) NOT NULL,
  "archivedAt" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_items_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_items_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "stock_items_baseUnit_check" CHECK ("baseUnit" IN ('piece', 'g', 'kg', 'ml', 'l')),
  CONSTRAINT "stock_items_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "stock_items_id_merchantId_key" ON "stock_items"("id", "merchantId");
CREATE UNIQUE INDEX "stock_items_merchantId_creationRequest_key" ON "stock_items"("merchantId", "creationRequest");
CREATE INDEX "stock_items_merchantId_archivedAt_createdAt_id_idx" ON "stock_items"("merchantId", "archivedAt", "createdAt", "id");

CREATE TABLE "stock_item_units" (
  "id" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "baseQuantity" DECIMAL(18,6) NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_item_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_item_units_stockItemId_merchantId_fkey" FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_item_units_code_check" CHECK ("code" ~ '^[a-z][a-z0-9_-]{0,31}$' AND "code" NOT IN ('piece', 'g', 'kg', 'ml', 'l')),
  CONSTRAINT "stock_item_units_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "stock_item_units_baseQuantity_check" CHECK ("baseQuantity" > 0)
);
CREATE UNIQUE INDEX "stock_item_units_stockItemId_code_key" ON "stock_item_units"("stockItemId", "code");
CREATE UNIQUE INDEX "stock_item_units_id_stockItemId_merchantId_key" ON "stock_item_units"("id", "stockItemId", "merchantId");
