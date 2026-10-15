ALTER TABLE "merchants"
  ADD COLUMN "negativeStockPolicy" VARCHAR(16) NOT NULL DEFAULT 'allow',
  ADD COLUMN "inventoryPolicyRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "inventoryPolicyUpdatedBy" VARCHAR(80),
  ADD COLUMN "inventoryPolicyUpdatedAt" TIMESTAMPTZ(6),
  ADD CONSTRAINT "merchants_negativeStockPolicy_check" CHECK ("negativeStockPolicy" IN ('allow', 'prevent')),
  ADD CONSTRAINT "merchants_inventoryPolicyRevision_check" CHECK ("inventoryPolicyRevision" > 0);

CREATE TABLE "branches" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "address" VARCHAR(500),
  "archivedAt" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "branches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "branches_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "branches_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "branches_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "branches_id_merchantId_key" ON "branches"("id", "merchantId");
CREATE UNIQUE INDEX "branches_merchantId_name_key" ON "branches"("merchantId", "name");
CREATE INDEX "branches_merchantId_archivedAt_createdAt_id_idx" ON "branches"("merchantId", "archivedAt", "createdAt", "id");

CREATE TABLE "warehouses" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "isDefaultConsumption" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warehouses_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "warehouses_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "warehouses_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "warehouses_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "warehouses_id_merchantId_key" ON "warehouses"("id", "merchantId");
CREATE UNIQUE INDEX "warehouses_id_branchId_merchantId_key" ON "warehouses"("id", "branchId", "merchantId");
CREATE UNIQUE INDEX "warehouses_branchId_name_key" ON "warehouses"("branchId", "name");
CREATE UNIQUE INDEX "warehouses_one_default_consumption_per_branch_key" ON "warehouses"("branchId") WHERE "isDefaultConsumption" = true;
CREATE INDEX "warehouses_merchantId_branchId_archivedAt_createdAt_id_idx" ON "warehouses"("merchantId", "branchId", "archivedAt", "createdAt", "id");

CREATE TABLE "stock_balances" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "warehouseName" VARCHAR(160) NOT NULL,
  "branchName" VARCHAR(160) NOT NULL,
  "stockItemName" VARCHAR(160) NOT NULL,
  "baseUnit" VARCHAR(16) NOT NULL,
  "condition" VARCHAR(24) NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_balances_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_balances_warehouseId_merchantId_fkey" FOREIGN KEY ("warehouseId", "merchantId") REFERENCES "warehouses"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_balances_stockItemId_merchantId_fkey" FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_balances_condition_check" CHECK ("condition" IN ('available', 'non_sellable'))
);
CREATE UNIQUE INDEX "stock_balances_id_merchantId_key" ON "stock_balances"("id", "merchantId");
CREATE UNIQUE INDEX "stock_balances_merchantId_warehouseId_stockItemId_condition_key" ON "stock_balances"("merchantId", "warehouseId", "stockItemId", "condition");
CREATE INDEX "stock_balances_merchantId_warehouseId_createdAt_id_idx" ON "stock_balances"("merchantId", "warehouseId", "createdAt", "id");

CREATE TABLE "stock_movement_batches" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "sourceType" VARCHAR(32) NOT NULL,
  "sourceId" VARCHAR(80) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movement_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_movement_batches_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movement_batches_reason_check" CHECK (length(btrim("reason")) > 0)
);
CREATE UNIQUE INDEX "stock_movement_batches_id_merchantId_key" ON "stock_movement_batches"("id", "merchantId");
CREATE UNIQUE INDEX "stock_movement_batches_merchantId_requestId_key" ON "stock_movement_batches"("merchantId", "requestId");
CREATE UNIQUE INDEX "stock_movement_batches_merchantId_sourceType_sourceId_key" ON "stock_movement_batches"("merchantId", "sourceType", "sourceId");
CREATE INDEX "stock_movement_batches_merchantId_createdAt_id_idx" ON "stock_movement_batches"("merchantId", "createdAt", "id");

CREATE TABLE "stock_movements" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "warehouseId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "condition" VARCHAR(24) NOT NULL,
  "unitCode" VARCHAR(32) NOT NULL,
  "enteredQuantity" DECIMAL(18,6) NOT NULL,
  "baseDelta" DECIMAL(18,6) NOT NULL,
  "position" INTEGER NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_movements_batchId_merchantId_fkey" FOREIGN KEY ("batchId", "merchantId") REFERENCES "stock_movement_batches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_warehouseId_merchantId_fkey" FOREIGN KEY ("warehouseId", "merchantId") REFERENCES "warehouses"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_stockItemId_merchantId_fkey" FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "stock_movements_condition_check" CHECK ("condition" IN ('available', 'non_sellable')),
  CONSTRAINT "stock_movements_enteredQuantity_check" CHECK ("enteredQuantity" > 0),
  CONSTRAINT "stock_movements_baseDelta_check" CHECK ("baseDelta" <> 0)
);
CREATE UNIQUE INDEX "stock_movements_batchId_position_key" ON "stock_movements"("batchId", "position");
CREATE INDEX "stock_movements_merchantId_warehouseId_createdAt_id_idx" ON "stock_movements"("merchantId", "warehouseId", "createdAt", "id");
CREATE INDEX "stock_movements_merchantId_stockItemId_createdAt_id_idx" ON "stock_movements"("merchantId", "stockItemId", "createdAt", "id");
