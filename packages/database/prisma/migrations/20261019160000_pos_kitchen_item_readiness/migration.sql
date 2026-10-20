ALTER TABLE "storefront_order_lines"
ADD COLUMN "kitchenReadyAt" TIMESTAMPTZ(6);

UPDATE "storefront_order_lines" AS line
SET "kitchenReadyAt" = COALESCE(order_row."readyAt", order_row."completedAt")
FROM "storefront_orders" AS order_row
JOIN "pos_kitchen_tickets" AS ticket
  ON ticket."orderId" = order_row."id"
  AND ticket."merchantId" = order_row."merchantId"
WHERE line."orderId" = order_row."id"
  AND line."merchantId" = order_row."merchantId"
  AND order_row."status" IN ('ready', 'completed')
  AND COALESCE(order_row."readyAt", order_row."completedAt") IS NOT NULL;
