-- Saved employee permissions become the exact effective set the owner controls.
-- Before this migration the API combined the saved list with the role preset:
--   * branch_manager, inventory_officer, accountant, customer_service, kitchen:
--       role preset only (saved values ignored)
--   * cashier, supervisor, no role:
--       saved values plus the role preset
-- This stores that combined result, keeping only permissions the API knows,
-- so every existing employee keeps exactly the access they had.
-- Example: a cashier saved as {accept_recipe_orders,start_preparation} becomes
-- {accept_recipe_orders,open_register_shift,sell,start_preparation}.

-- Shift-close approval and cash movements were only granted through role presets,
-- so the saved-list check never allowed them. Allow every permission the API knows.
ALTER TABLE "pos_employees" DROP CONSTRAINT "pos_employees_permissions_check";
ALTER TABLE "pos_employees" ADD CONSTRAINT "pos_employees_permissions_check" CHECK (
  "permissions" <@ ARRAY[
    'accept_recipe_orders', 'start_preparation', 'open_register_shift', 'sell',
    'approve_discounts', 'approve_voids', 'approve_refunds', 'approve_shift_close',
    'manage_cash_movements', 'view_orders', 'view_receipts', 'view_inventory'
  ]::TEXT[]
);

UPDATE "pos_employees"
SET "permissions" = ARRAY(
  SELECT DISTINCT grant_name
  FROM unnest(
    CASE
      -- Unknown role values were treated like "no role", so they keep saved values too.
      WHEN "role" IS NULL OR "role" NOT IN (
        'branch_manager', 'inventory_officer', 'accountant', 'customer_service', 'kitchen'
      ) THEN "permissions"
      ELSE ARRAY[]::TEXT[]
    END
    || CASE "role"
      WHEN 'branch_manager' THEN ARRAY[
        'view_orders', 'accept_recipe_orders', 'start_preparation', 'open_register_shift',
        'sell', 'view_receipts', 'view_inventory', 'approve_discounts', 'approve_refunds',
        'approve_shift_close', 'manage_cash_movements'
      ]::TEXT[]
      WHEN 'cashier' THEN ARRAY['open_register_shift', 'sell']::TEXT[]
      WHEN 'inventory_officer' THEN ARRAY['view_inventory']::TEXT[]
      WHEN 'accountant' THEN ARRAY['view_receipts']::TEXT[]
      WHEN 'customer_service' THEN ARRAY['view_orders']::TEXT[]
      WHEN 'kitchen' THEN ARRAY['view_orders', 'accept_recipe_orders', 'start_preparation']::TEXT[]
      WHEN 'supervisor' THEN ARRAY[
        'open_register_shift', 'sell', 'approve_discounts', 'approve_voids', 'approve_refunds',
        'approve_shift_close', 'manage_cash_movements'
      ]::TEXT[]
      ELSE ARRAY[]::TEXT[]
    END
  ) AS grant_name
  WHERE grant_name IN (
    'accept_recipe_orders', 'start_preparation', 'open_register_shift', 'sell',
    'approve_discounts', 'approve_voids', 'approve_refunds', 'approve_shift_close',
    'manage_cash_movements', 'view_orders', 'view_receipts', 'view_inventory'
  )
  ORDER BY grant_name
);
