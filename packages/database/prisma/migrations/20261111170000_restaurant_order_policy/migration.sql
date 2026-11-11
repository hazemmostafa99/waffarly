ALTER TABLE "storefront_orders"
ADD COLUMN "subtotal" DECIMAL(12,2),
ADD COLUMN "deliveryFee" DECIMAL(12,2),
ADD COLUMN "fulfillmentPolicy" JSONB;
ALTER TABLE "storefront_orders" ADD CONSTRAINT "storefront_order_delivery_totals" CHECK (
("subtotal" IS NULL AND "deliveryFee" IS NULL) OR
("subtotal" IS NOT NULL AND "deliveryFee" IS NOT NULL AND "subtotal" >= 0 AND "deliveryFee" >= 0 AND "total" = "subtotal" + "deliveryFee")
);
