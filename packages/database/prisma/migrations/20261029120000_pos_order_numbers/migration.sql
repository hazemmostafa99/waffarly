ALTER TABLE "storefront_orders" ADD COLUMN "orderReference" VARCHAR(64);
CREATE UNIQUE INDEX "storefront_orders_merchantId_orderReference_key" ON "storefront_orders"("merchantId", "orderReference");
CREATE TABLE "pos_order_branch_codes" (
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "code" INTEGER GENERATED ALWAYS AS IDENTITY,
  PRIMARY KEY ("merchantId", "branchId"),
  UNIQUE ("code"),
  FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "pos_order_daily_counters" (
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "businessDate" DATE NOT NULL,
  "lastNumber" INTEGER NOT NULL CHECK ("lastNumber" > 0),
  PRIMARY KEY ("merchantId", "branchId", "businessDate"),
  FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
