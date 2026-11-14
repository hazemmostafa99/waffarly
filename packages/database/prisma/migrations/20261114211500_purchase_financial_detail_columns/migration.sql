-- Keep the local schema compatible with the finalized purchase read models.
-- IF NOT EXISTS also supports databases that first apply the finalized base migration.
ALTER TABLE "purchase_invoice_corrections"
  ADD COLUMN IF NOT EXISTS "amountDelta" DECIMAL(12,2) NOT NULL,
  ADD COLUMN IF NOT EXISTS "fingerprint" VARCHAR(64) NOT NULL;

ALTER TABLE "purchase_supplier_credit_notes"
  ADD COLUMN IF NOT EXISTS "fingerprint" VARCHAR(64) NOT NULL;
