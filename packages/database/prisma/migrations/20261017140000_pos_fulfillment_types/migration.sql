ALTER TABLE "storefront_orders"
  DROP CONSTRAINT "storefront_orders_fulfillmentType_check",
  DROP CONSTRAINT "storefront_orders_deliveryAddress_check";

ALTER TABLE "storefront_orders"
  ADD CONSTRAINT "storefront_orders_fulfillmentType_check"
    CHECK ("fulfillmentType" IN ('pickup', 'delivery', 'dine_in', 'takeaway')),
  ADD CONSTRAINT "storefront_orders_deliveryAddress_check"
    CHECK (
      ("fulfillmentType" = 'delivery' AND "deliveryAddress" IS NOT NULL AND length(btrim("deliveryAddress")) >= 8)
      OR ("fulfillmentType" IN ('pickup', 'dine_in', 'takeaway') AND "deliveryAddress" IS NULL)
    );
