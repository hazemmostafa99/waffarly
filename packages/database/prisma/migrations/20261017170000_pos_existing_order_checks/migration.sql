-- Preserve M3 POS sales as the original single, unpaid check for M5 settlement.
-- Historical dine-in orders keep no table/session assignment because that fact was never captured.
INSERT INTO "pos_order_checks" (
  "id", "orderId", "merchantId", "position", "amount", "splitMethod", "createdAt"
)
SELECT
  gen_random_uuid(), orders."id", orders."merchantId", 0, orders."total", 'whole', orders."createdAt"
FROM "storefront_orders" AS orders
WHERE orders."source" = 'pos'
  AND orders."total" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "pos_order_checks" AS checks
    WHERE checks."orderId" = orders."id"
      AND checks."merchantId" = orders."merchantId"
  );
