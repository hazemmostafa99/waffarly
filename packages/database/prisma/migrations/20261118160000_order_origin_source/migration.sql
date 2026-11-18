UPDATE "storefront_orders" AS orders
SET "source" = 'waffarly'
WHERE orders."source" = 'storefront'
  AND EXISTS (
    SELECT 1
    FROM "customer_order_access" AS access
    WHERE access."orderId" = orders."id"
      AND access."merchantId" = orders."merchantId"
  );

DROP INDEX IF EXISTS "storefront_orders_merchantId_source_createdAt_idx";
CREATE INDEX "storefront_orders_merchantId_source_createdAt_id_idx"
  ON "storefront_orders"("merchantId", "source", "createdAt", "id");
