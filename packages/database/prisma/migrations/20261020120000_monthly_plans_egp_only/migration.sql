-- Keep historical amounts intact. Existing non-EGP offers must be reviewed
-- before applying this restriction; changing a currency code is not conversion.
BEGIN;

ALTER TABLE "monthly_plans"
    DROP CONSTRAINT "monthly_plans_currency_check",
    ADD CONSTRAINT "monthly_plans_currency_check" CHECK ("currency" = 'EGP');

COMMIT;
