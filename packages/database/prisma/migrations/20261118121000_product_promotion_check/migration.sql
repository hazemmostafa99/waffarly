ALTER TABLE "products"
  DROP CONSTRAINT "products_promotion_value_shape_check",
  ADD CONSTRAINT "products_promotion_value_shape_check" CHECK (
    ("promotionType" IS NULL AND "promotionValue" IS NULL)
    OR (
      "promotionType" IS NOT NULL
      AND "promotionValue" IS NOT NULL
      AND "promotionType" IN ('percentage', 'amount')
      AND "promotionValue" > 0
      AND ("promotionType" <> 'percentage' OR "promotionValue" < 100)
    )
  );
