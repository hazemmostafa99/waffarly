ALTER TABLE "storefront_order_lines"
  DROP CONSTRAINT "order_line_stock_handling",
  ADD CONSTRAINT "order_line_stock_handling"
    CHECK ("stockHandling" IN ('legacy', 'recipe_acceptance', 'direct_sale'));

ALTER TABLE "storefront_order_actions"
  DROP CONSTRAINT "order_action_kind",
  ADD CONSTRAINT "order_action_kind"
    CHECK ("action" IN ('accept', 'prepare', 'cancel', 'pos_sale'));
