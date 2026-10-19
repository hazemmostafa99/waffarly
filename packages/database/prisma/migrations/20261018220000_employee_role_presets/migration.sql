-- Expand the allowed values without rewriting existing roles or grants.
ALTER TABLE "pos_employees"
  DROP CONSTRAINT "pos_employees_role_check",
  DROP CONSTRAINT "pos_employees_permissions_check",
  ADD CONSTRAINT "pos_employees_role_check"
    CHECK ("role" IS NULL OR "role" IN (
      'cashier', 'supervisor', 'branch_manager', 'inventory_officer',
      'accountant', 'customer_service', 'kitchen'
    )),
  ADD CONSTRAINT "pos_employees_permissions_check"
    CHECK ("permissions" <@ ARRAY[
      'accept_recipe_orders', 'start_preparation', 'open_register_shift', 'sell',
      'approve_discounts', 'approve_voids', 'approve_refunds',
      'view_orders', 'view_receipts', 'view_inventory'
    ]::TEXT[]);
