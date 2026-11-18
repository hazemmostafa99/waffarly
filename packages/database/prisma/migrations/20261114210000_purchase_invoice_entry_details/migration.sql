ALTER TABLE "purchase_invoices"
  ADD COLUMN "invoiceDate" DATE,
  ADD COLUMN "notes" VARCHAR(2000),
  ADD COLUMN "discountType" VARCHAR(16) NOT NULL DEFAULT 'amount',
  ADD COLUMN "discountValue" DECIMAL(18,2);

ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoice_discount_input"
CHECK ("discountType" IN ('amount', 'percentage') AND
  ("discountValue" IS NULL OR ("discountValue" >= 0 AND
    ("discountType" <> 'percentage' OR "discountValue" <= 100))));
