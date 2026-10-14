CREATE TABLE "storefront_orders" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "customerName" VARCHAR(120) NOT NULL,
  "customerPhone" VARCHAR(32) NOT NULL,
  "fulfillmentType" VARCHAR(16) NOT NULL,
  "deliveryAddress" TEXT,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'EGP',
  "total" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "storefront_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storefront_orders_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "storefront_orders_fulfillmentType_check" CHECK ("fulfillmentType" IN ('pickup', 'delivery')),
  CONSTRAINT "storefront_orders_deliveryAddress_check"
    CHECK (("fulfillmentType" = 'pickup' AND "deliveryAddress" IS NULL) OR ("fulfillmentType" = 'delivery' AND "deliveryAddress" IS NOT NULL AND length(btrim("deliveryAddress")) >= 8)),
  CONSTRAINT "storefront_orders_status_check" CHECK ("status" IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT "storefront_orders_currency_check" CHECK ("currency" = 'EGP'),
  CONSTRAINT "storefront_orders_total_check" CHECK ("total" >= 0)
);

CREATE UNIQUE INDEX "storefront_orders_id_merchantId_key"
ON "storefront_orders"("id", "merchantId");

CREATE INDEX "storefront_orders_merchantId_status_createdAt_idx"
ON "storefront_orders"("merchantId", "status", "createdAt");

CREATE TABLE "storefront_order_lines" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "variantId" UUID,
  "productName" VARCHAR(160) NOT NULL,
  "variantName" VARCHAR(160),
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "stockReserved" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "storefront_order_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storefront_order_lines_orderId_merchantId_fkey"
    FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "storefront_order_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "storefront_order_lines_unitPrice_check" CHECK ("unitPrice" >= 0),
  CONSTRAINT "storefront_order_lines_lineTotal_check" CHECK ("lineTotal" = "unitPrice" * "quantity"),
  CONSTRAINT "storefront_order_lines_position_check" CHECK ("position" >= 0)
);

CREATE INDEX "storefront_order_lines_orderId_position_idx"
ON "storefront_order_lines"("orderId", "position");

CREATE INDEX "storefront_order_lines_merchantId_variantId_idx"
ON "storefront_order_lines"("merchantId", "variantId");

CREATE TABLE "storefront_order_line_selections" (
  "id" UUID NOT NULL,
  "orderLineId" UUID NOT NULL,
  "groupName" VARCHAR(160) NOT NULL,
  "optionName" VARCHAR(160) NOT NULL,
  "priceAdjustment" DECIMAL(12,2) NOT NULL,
  "groupPosition" INTEGER NOT NULL DEFAULT 0,
  "optionPosition" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "storefront_order_line_selections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "storefront_order_line_selections_orderLineId_fkey"
    FOREIGN KEY ("orderLineId") REFERENCES "storefront_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "storefront_order_line_selections_priceAdjustment_check" CHECK ("priceAdjustment" >= 0),
  CONSTRAINT "storefront_order_line_selections_position_check" CHECK ("groupPosition" >= 0 AND "optionPosition" >= 0)
);

CREATE INDEX "storefront_order_line_selections_orderLineId_groupPosition_optionPosition_idx"
ON "storefront_order_line_selections"("orderLineId", "groupPosition", "optionPosition");
