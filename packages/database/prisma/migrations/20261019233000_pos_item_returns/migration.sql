CREATE TABLE "pos_order_item_returns" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "createdByEmployeeId" UUID NOT NULL,
    "approvedByEmployeeId" UUID,
    "returnNumber" VARCHAR(40) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
    "issuedAt" TIMESTAMPTZ(6) NOT NULL,
    "snapshot" JSONB NOT NULL,
    CONSTRAINT "pos_order_item_returns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pos_order_item_returns_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "pos_order_item_returns_merchant_fkey"
      FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_order_item_returns_order_fkey"
      FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_order_item_returns_issuer_fkey"
      FOREIGN KEY ("createdByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_order_item_returns_approver_fkey"
      FOREIGN KEY ("approvedByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pos_order_item_returns_id_orderId_merchantId_key"
  ON "pos_order_item_returns"("id", "orderId", "merchantId");
CREATE UNIQUE INDEX "pos_order_item_returns_merchantId_requestId_key"
  ON "pos_order_item_returns"("merchantId", "requestId");
CREATE UNIQUE INDEX "pos_order_item_returns_merchantId_returnNumber_key"
  ON "pos_order_item_returns"("merchantId", "returnNumber");
CREATE INDEX "pos_order_item_returns_merchantId_orderId_issuedAt_idx"
  ON "pos_order_item_returns"("merchantId", "orderId", "issuedAt");

CREATE TABLE "pos_order_item_return_lines" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "productName" VARCHAR(160) NOT NULL,
    "variantName" VARCHAR(160),
    "quantity" INTEGER NOT NULL,
    "disposition" VARCHAR(16) NOT NULL DEFAULT 'waste',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "pos_order_item_return_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pos_order_item_return_lines_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "pos_order_item_return_lines_disposition_check" CHECK ("disposition" = 'waste'),
    CONSTRAINT "pos_order_item_return_lines_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "pos_order_item_return_lines_unit_price_check" CHECK ("unitPrice" >= 0),
    CONSTRAINT "pos_order_item_return_lines_return_fkey"
      FOREIGN KEY ("returnId", "orderId", "merchantId") REFERENCES "pos_order_item_returns"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pos_order_item_return_lines_order_line_fkey"
      FOREIGN KEY ("orderLineId", "orderId", "merchantId") REFERENCES "storefront_order_lines"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pos_order_item_return_lines_returnId_orderLineId_key"
  ON "pos_order_item_return_lines"("returnId", "orderLineId");
CREATE INDEX "pos_order_item_return_lines_merchantId_orderLineId_idx"
  ON "pos_order_item_return_lines"("merchantId", "orderLineId");
