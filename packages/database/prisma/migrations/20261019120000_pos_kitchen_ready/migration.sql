ALTER TABLE "storefront_orders"
  ADD COLUMN "readyAt" TIMESTAMPTZ(6);

ALTER TABLE "storefront_orders"
  DROP CONSTRAINT "storefront_orders_status_check",
  ADD CONSTRAINT "storefront_orders_status_check"
    CHECK ("status" IN ('pending', 'accepted', 'rejected', 'preparing', 'ready', 'cancelled'));

ALTER TABLE "storefront_order_actions"
  DROP CONSTRAINT "order_action_kind",
  ADD CONSTRAINT "order_action_kind"
    CHECK ("action" IN (
      'accept', 'prepare', 'cancel', 'pos_sale', 'dining_move', 'dining_split',
      'pos_payment', 'pos_kitchen_dispatch', 'ready'
    ));
