ALTER TABLE "products"
  ADD COLUMN "promotionEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "promotionType" VARCHAR(16),
  ADD COLUMN "promotionValue" DECIMAL(12, 2),
  ADD COLUMN "promotionStartsAt" TIMESTAMPTZ(6),
  ADD COLUMN "promotionEndsAt" TIMESTAMPTZ(6),
  ADD CONSTRAINT "products_promotion_value_shape_check" CHECK (
    ("promotionType" IS NULL AND "promotionValue" IS NULL)
    OR (
      "promotionType" IN ('percentage', 'amount')
      AND "promotionValue" > 0
      AND ("promotionType" <> 'percentage' OR "promotionValue" < 100)
    )
  ),
  ADD CONSTRAINT "products_enabled_promotion_check" CHECK (
    NOT "promotionEnabled"
    OR ("promotionType" IS NOT NULL AND "promotionValue" IS NOT NULL)
  ),
  ADD CONSTRAINT "products_promotion_period_check" CHECK (
    "promotionStartsAt" IS NULL
    OR "promotionEndsAt" IS NULL
    OR "promotionEndsAt" > "promotionStartsAt"
  );

ALTER TABLE "storefront_order_lines"
  ADD COLUMN "promotionType" VARCHAR(16),
  ADD COLUMN "promotionValue" DECIMAL(12, 2),
  ADD COLUMN "promotionDiscount" DECIMAL(12, 2) NOT NULL DEFAULT 0;
