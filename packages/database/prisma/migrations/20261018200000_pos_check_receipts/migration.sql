CREATE TABLE "pos_check_receipts" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "checkId" UUID NOT NULL,
  "createdByEmployeeId" UUID NOT NULL,
  "receiptNumber" VARCHAR(32) NOT NULL,
  "issuedAt" TIMESTAMPTZ(6) NOT NULL,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "pos_check_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_check_receipts_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_check_receipts_orderId_merchantId_fkey"
    FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_check_receipts_checkId_orderId_merchantId_fkey"
    FOREIGN KEY ("checkId", "orderId", "merchantId") REFERENCES "pos_order_checks"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_check_receipts_createdByEmployeeId_merchantId_fkey"
    FOREIGN KEY ("createdByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pos_check_receipts_merchantId_receiptNumber_key"
  ON "pos_check_receipts"("merchantId", "receiptNumber");
CREATE UNIQUE INDEX "pos_check_receipts_checkId_key"
  ON "pos_check_receipts"("checkId");
CREATE UNIQUE INDEX "pos_check_receipts_checkId_orderId_merchantId_key"
  ON "pos_check_receipts"("checkId", "orderId", "merchantId");
CREATE INDEX "pos_check_receipts_merchantId_orderId_issuedAt_idx"
  ON "pos_check_receipts"("merchantId", "orderId", "issuedAt");
