-- Preserve historical quantity-only receipts as unknown cost instead of zero.
ALTER TABLE "purchase_invoices"
ADD COLUMN "totalAmount" DECIMAL(18, 2);

ALTER TABLE "purchase_invoice_lines"
ADD COLUMN "unitCost" DECIMAL(18, 2),
ADD COLUMN "lineTotal" DECIMAL(18, 2);
