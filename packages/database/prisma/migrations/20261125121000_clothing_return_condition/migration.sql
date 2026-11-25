ALTER TABLE "pos_order_item_return_lines" DROP CONSTRAINT "pos_order_item_return_lines_disposition_check";
ALTER TABLE "pos_order_item_return_lines" ADD CONSTRAINT "pos_order_item_return_lines_disposition_check" CHECK ("disposition" IN ('waste', 'restock'));
