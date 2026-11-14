ALTER TABLE "purchase_invoices"
ADD COLUMN "subtotalAmount" DECIMAL(18, 2),
ADD COLUMN "discountAmount" DECIMAL(18, 2),
ADD COLUMN "shippingAmount" DECIMAL(18, 2);

-- P01 invoices have a known line subtotal and no invoice-level adjustments.
UPDATE "purchase_invoices"
SET "subtotalAmount" = "totalAmount",
    "discountAmount" = 0,
    "shippingAmount" = 0
WHERE "totalAmount" IS NOT NULL;

ALTER TABLE "purchase_invoice_lines"
ADD COLUMN "lineSubtotal" DECIMAL(18, 2),
ADD COLUMN "discountAllocation" DECIMAL(18, 2),
ADD COLUMN "shippingAllocation" DECIMAL(18, 2);

-- Preserve P01 line totals as pre-adjustment subtotals.
UPDATE "purchase_invoice_lines"
SET "lineSubtotal" = "lineTotal",
    "discountAllocation" = 0,
    "shippingAllocation" = 0
WHERE "lineTotal" IS NOT NULL;
