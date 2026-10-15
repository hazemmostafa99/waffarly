ALTER TABLE "stock_balances"
  DROP COLUMN "warehouseName",
  DROP COLUMN "branchName",
  DROP COLUMN "stockItemName",
  DROP COLUMN "baseUnit";

ALTER TABLE "stock_movements"
  ADD COLUMN "warehouseName" VARCHAR(160) NOT NULL,
  ADD COLUMN "branchName" VARCHAR(160) NOT NULL,
  ADD COLUMN "stockItemName" VARCHAR(160) NOT NULL,
  ADD COLUMN "baseUnit" VARCHAR(16) NOT NULL;
