-- Historical revenue is recoverable from the saved item prices; historical cost is not.
-- Keep all backfilled cost snapshots null so reports continue to show incomplete coverage.

UPDATE "storefront_order_lines" AS l
SET "recognizedRevenueAmount" = l."lineTotal",
    "revenueRecognizedAt" = o."createdAt"
FROM "storefront_orders" AS o
WHERE o."id" = l."orderId"
  AND o."merchantId" = l."merchantId"
  AND o."source" = 'pos'
  AND o."status" IN ('pending', 'accepted', 'preparing', 'ready', 'completed')
  AND l."recognizedRevenueAmount" IS NULL
  AND l."revenueRecognizedAt" IS NULL;

WITH eligible_orders AS (
  SELECT o."id", o."merchantId",
    COALESCE(o."acceptedAt", o."preparationStartedAt", o."readyAt", o."completedAt", o."updatedAt") AS recognized_at,
    ROUND(COALESCE(d."amount", 0) * 100)::numeric AS discount_cents
  FROM "storefront_orders" AS o
  LEFT JOIN "merchant_discount_redemptions" AS d
    ON d."orderId" = o."id" AND d."merchantId" = o."merchantId"
  WHERE o."source" = 'storefront'
    AND o."status" IN ('accepted', 'preparing', 'ready', 'completed')
    AND NOT EXISTS (
      SELECT 1
      FROM "storefront_order_lines" AS existing
      WHERE existing."orderId" = o."id"
        AND existing."merchantId" = o."merchantId"
        AND (existing."recognizedRevenueAmount" IS NOT NULL OR existing."revenueRecognizedAt" IS NOT NULL)
    )
), line_weights AS (
  SELECT l."id", l."merchantId", l."orderId", l."position",
    ROUND(l."lineTotal" * 100)::numeric AS line_cents,
    e.discount_cents,
    e.recognized_at
  FROM "storefront_order_lines" AS l
  JOIN eligible_orders AS e ON e."id" = l."orderId" AND e."merchantId" = l."merchantId"
), line_totals AS (
  SELECT *, SUM(line_cents) OVER (PARTITION BY "orderId", "merchantId") AS subtotal_cents
  FROM line_weights
), base_shares AS (
  SELECT *,
    CASE WHEN subtotal_cents = 0 THEN 0::numeric
      ELSE FLOOR(discount_cents * line_cents / subtotal_cents)
    END AS base_discount_cents,
    CASE WHEN subtotal_cents = 0 THEN 0::numeric
      ELSE MOD(discount_cents * line_cents, subtotal_cents)
    END AS remainder
  FROM line_totals
  WHERE discount_cents <= subtotal_cents
), ranked_shares AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY "orderId", "merchantId"
      ORDER BY remainder DESC, "position" ASC, "id" ASC
    ) AS remainder_rank,
    SUM(base_discount_cents) OVER (PARTITION BY "orderId", "merchantId") AS allocated_base_cents
  FROM base_shares
), allocated_shares AS (
  SELECT *, base_discount_cents + CASE
    WHEN remainder_rank <= discount_cents - allocated_base_cents THEN 1::numeric
    ELSE 0::numeric
  END AS discount_allocation_cents
  FROM ranked_shares
)
UPDATE "storefront_order_lines" AS l
SET "recognizedRevenueAmount" = ((a.line_cents - a.discount_allocation_cents) / 100)::numeric(12,2),
    "revenueRecognizedAt" = a.recognized_at
FROM allocated_shares AS a
WHERE l."id" = a."id"
  AND l."merchantId" = a."merchantId"
  AND l."orderId" = a."orderId"
  AND l."recognizedRevenueAmount" IS NULL
  AND l."revenueRecognizedAt" IS NULL;
