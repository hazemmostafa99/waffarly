-- Online DIRECT orders save their stock requirements for consumption at acceptance.
-- Extend the existing rule so environments with additional valid modes keep them.
DO $migration$
DECLARE
  existing_condition TEXT;
BEGIN
  SELECT pg_get_expr(conbin, conrelid)
  INTO STRICT existing_condition
  FROM pg_constraint
  WHERE conrelid = 'public.storefront_order_lines'::regclass
    AND conname = 'order_line_stock_handling'
    AND contype = 'c';

  EXECUTE format(
    'ALTER TABLE public.storefront_order_lines
       DROP CONSTRAINT order_line_stock_handling,
       ADD CONSTRAINT order_line_stock_handling
       CHECK ((%s) OR "stockHandling" = %L)',
    existing_condition,
    'direct_acceptance'
  );
END;
$migration$;
