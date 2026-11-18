ALTER TABLE "stock_movements"
ADD COLUMN "costRevision" INTEGER,
ADD COLUMN "baseUnitCost" DECIMAL(38,12);

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_merchantId_stockItemId_costRevision_fkey"
FOREIGN KEY ("merchantId", "stockItemId", "costRevision")
REFERENCES "stock_item_cost_events"("merchantId", "stockItemId", "revision")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_cost_snapshot_pair_check"
CHECK (("costRevision" IS NULL) = ("baseUnitCost" IS NULL));
