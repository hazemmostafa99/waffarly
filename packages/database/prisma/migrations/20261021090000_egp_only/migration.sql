-- Enforce the application's single currency without changing historical amounts.
BEGIN;

ALTER TABLE "monthly_plans" ALTER COLUMN "currency" SET DEFAULT 'EGP';

ALTER TABLE "pos_shifts"
    DROP CONSTRAINT "pos_shifts_currency_check",
    ADD CONSTRAINT "pos_shifts_currency_check" CHECK ("currency" = 'EGP');

ALTER TABLE "pos_order_payments"
    ADD CONSTRAINT "pos_order_payments_currency_check" CHECK ("currency" = 'EGP');

ALTER TABLE "pos_order_refunds"
    ADD CONSTRAINT "pos_order_refunds_currency_check" CHECK ("currency" = 'EGP');

ALTER TABLE "pos_order_item_returns"
    ADD CONSTRAINT "pos_order_item_returns_currency_check" CHECK ("currency" = 'EGP');

ALTER TABLE "pos_shift_close_reports"
    ADD CONSTRAINT "pos_shift_close_reports_currency_check" CHECK ("currency" = 'EGP');

COMMIT;
