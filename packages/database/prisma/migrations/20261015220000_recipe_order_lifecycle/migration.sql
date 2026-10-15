-- AlterTable
ALTER TABLE "storefront_orders" ADD COLUMN     "acceptedAt" TIMESTAMPTZ(6),
ADD COLUMN     "branchId" UUID,
ADD COLUMN     "branchName" VARCHAR(160),
ADD COLUMN     "cancellationReason" VARCHAR(500),
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(6),
ADD COLUMN     "preparationStartedAt" TIMESTAMPTZ(6),
ADD COLUMN     "stockRestored" BOOLEAN,
ADD COLUMN     "warehouseId" UUID,
ADD COLUMN     "warehouseName" VARCHAR(160);

-- AlterTable
ALTER TABLE "storefront_order_lines" ADD COLUMN     "stockHandling" VARCHAR(24) NOT NULL DEFAULT 'legacy';

-- CreateTable
CREATE TABLE "storefront_order_actions" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "createdBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_order_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_order_stock_batches" (
    "orderId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "storefront_order_stock_batches_pkey" PRIMARY KEY ("orderId","role","position")
);

-- CreateIndex
CREATE INDEX "storefront_order_actions_orderId_merchantId_createdAt_idx" ON "storefront_order_actions"("orderId", "merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_order_actions_merchantId_requestId_key" ON "storefront_order_actions"("merchantId", "requestId");

-- CreateIndex
CREATE INDEX "storefront_order_stock_batches_merchantId_orderId_idx" ON "storefront_order_stock_batches"("merchantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_order_stock_batches_batchId_key" ON "storefront_order_stock_batches"("batchId");

-- CreateIndex
CREATE INDEX "storefront_orders_merchantId_warehouseId_status_idx" ON "storefront_orders"("merchantId", "warehouseId", "status");

-- CreateIndex
CREATE INDEX "storefront_orders_merchantId_branchId_status_idx" ON "storefront_orders"("merchantId", "branchId", "status");

-- AddForeignKey
ALTER TABLE "storefront_orders" ADD CONSTRAINT "storefront_orders_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_orders" ADD CONSTRAINT "storefront_orders_warehouseId_merchantId_fkey" FOREIGN KEY ("warehouseId", "merchantId") REFERENCES "warehouses"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_order_actions" ADD CONSTRAINT "storefront_order_actions_orderId_merchantId_fkey" FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_order_stock_batches" ADD CONSTRAINT "storefront_order_stock_batches_orderId_merchantId_fkey" FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_order_stock_batches" ADD CONSTRAINT "storefront_order_stock_batches_batchId_merchantId_fkey" FOREIGN KEY ("batchId", "merchantId") REFERENCES "stock_movement_batches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storefront_order_lines" ADD CONSTRAINT "order_line_stock_handling" CHECK ("stockHandling" IN ('legacy', 'recipe_acceptance'));
ALTER TABLE "storefront_order_actions" ADD CONSTRAINT "order_action_kind" CHECK ("action" IN ('accept', 'prepare', 'cancel'));
ALTER TABLE "storefront_order_stock_batches" ADD CONSTRAINT "order_stock_batch_role" CHECK ("role" IN ('consumption', 'restoration') AND "position" >= 0);
CREATE INDEX "pending_recipe_product" ON "storefront_order_lines" ("merchantId", "productId", "orderId") WHERE "stockHandling" = 'recipe_acceptance';

ALTER TABLE "storefront_orders" DROP CONSTRAINT "storefront_orders_status_check";
ALTER TABLE "storefront_orders" ADD CONSTRAINT "storefront_orders_status_check" CHECK ("status" IN ('pending', 'accepted', 'rejected', 'preparing', 'cancelled'));
