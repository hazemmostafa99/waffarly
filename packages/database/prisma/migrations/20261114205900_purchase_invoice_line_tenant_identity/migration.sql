-- Existing line IDs are already unique; expose their tenant pair for scoped references.
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_invoice_lines_tenant_identity_key"
ON "purchase_invoice_lines"("id", "merchantId");
