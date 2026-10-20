ALTER TABLE "storefront_order_actions"
  DROP CONSTRAINT "order_action_kind",
  ADD CONSTRAINT "order_action_kind"
    CHECK ("action" IN (
      'accept', 'prepare', 'cancel', 'pos_sale', 'dining_move', 'dining_split',
      'pos_payment', 'pos_kitchen_dispatch', 'ready', 'handover', 'ready_item',
      'pos_kitchen_amendment', 'pos_cancel', 'pos_cancel_ack'
    ));
