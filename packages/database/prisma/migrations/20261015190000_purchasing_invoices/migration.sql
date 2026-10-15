CREATE TABLE "purchase_suppliers" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "creationRequest" UUID NOT NULL,
  "creationFingerprint" VARCHAR(64) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "nameKey" VARCHAR(160) NOT NULL,
  "contactName" VARCHAR(160),
  "phone" VARCHAR(32),
  "email" VARCHAR(254),
  "address" VARCHAR(500),
  "archivedAt" TIMESTAMPTZ(6),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "purchase_suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_suppliers_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_suppliers_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "purchase_suppliers_nameKey_check" CHECK ("nameKey" = lower(btrim("name"))),
  CONSTRAINT "purchase_suppliers_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "purchase_suppliers_id_merchantId_key" ON "purchase_suppliers"("id", "merchantId");
CREATE UNIQUE INDEX "purchase_suppliers_merchantId_creationRequest_key" ON "purchase_suppliers"("merchantId", "creationRequest");
CREATE UNIQUE INDEX "purchase_suppliers_merchantId_nameKey_key" ON "purchase_suppliers"("merchantId", "nameKey");
CREATE INDEX "purchase_suppliers_merchantId_archivedAt_createdAt_id_idx" ON "purchase_suppliers"("merchantId", "archivedAt", "createdAt", "id");

CREATE TABLE "purchase_invoices" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "supplierName" VARCHAR(160) NOT NULL,
  "supplierInvoiceNumber" VARCHAR(100),
  "supplierInvoiceNumberKey" VARCHAR(100),
  "warehouseId" UUID NOT NULL,
  "warehouseName" VARCHAR(160) NOT NULL,
  "branchName" VARCHAR(160) NOT NULL,
  "creationRequest" UUID NOT NULL,
  "creationFingerprint" VARCHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "confirmedAt" TIMESTAMPTZ(6),
  "confirmedBy" VARCHAR(80),
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoices_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoices_supplierId_merchantId_fkey" FOREIGN KEY ("supplierId", "merchantId") REFERENCES "purchase_suppliers"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoices_warehouseId_merchantId_fkey" FOREIGN KEY ("warehouseId", "merchantId") REFERENCES "warehouses"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoices_supplierName_check" CHECK (length(btrim("supplierName")) > 0),
  CONSTRAINT "purchase_invoices_supplierInvoiceNumber_check" CHECK (
    ("supplierInvoiceNumber" IS NULL AND "supplierInvoiceNumberKey" IS NULL)
    OR (length(btrim("supplierInvoiceNumber")) > 0 AND length(btrim("supplierInvoiceNumberKey")) > 0)
  ),
  CONSTRAINT "purchase_invoices_status_check" CHECK ("status" IN ('draft', 'confirmed')),
  CONSTRAINT "purchase_invoices_confirmation_check" CHECK (
    ("status" = 'draft' AND "confirmedAt" IS NULL AND "confirmedBy" IS NULL)
    OR ("status" = 'confirmed' AND "confirmedAt" IS NOT NULL AND "confirmedBy" IS NOT NULL)
  ),
  CONSTRAINT "purchase_invoices_revision_check" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "purchase_invoices_id_merchantId_key" ON "purchase_invoices"("id", "merchantId");
CREATE UNIQUE INDEX "purchase_invoices_merchantId_creationRequest_key" ON "purchase_invoices"("merchantId", "creationRequest");
CREATE UNIQUE INDEX "purchase_invoices_merchantId_supplierId_supplierInvoiceNumberKey_key" ON "purchase_invoices"("merchantId", "supplierId", "supplierInvoiceNumberKey");
CREATE INDEX "purchase_invoices_merchantId_status_createdAt_id_idx" ON "purchase_invoices"("merchantId", "status", "createdAt", "id");
CREATE INDEX "purchase_invoices_merchantId_supplierId_createdAt_id_idx" ON "purchase_invoices"("merchantId", "supplierId", "createdAt", "id");

CREATE TABLE "purchase_invoice_lines" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "stockItemName" VARCHAR(160) NOT NULL,
  "baseUnit" VARCHAR(16) NOT NULL,
  "unitCode" VARCHAR(32) NOT NULL,
  "unitName" VARCHAR(80) NOT NULL,
  "condition" VARCHAR(24) NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoice_lines_invoiceId_merchantId_fkey" FOREIGN KEY ("invoiceId", "merchantId") REFERENCES "purchase_invoices"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoice_lines_stockItemId_merchantId_fkey" FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoice_lines_baseUnit_check" CHECK ("baseUnit" IN ('piece', 'g', 'kg', 'ml', 'l')),
  CONSTRAINT "purchase_invoice_lines_unitCode_check" CHECK ("unitCode" ~ '^[a-z][a-z0-9_-]{0,31}$'),
  CONSTRAINT "purchase_invoice_lines_condition_check" CHECK ("condition" IN ('available', 'non_sellable')),
  CONSTRAINT "purchase_invoice_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "purchase_invoice_lines_position_check" CHECK ("position" >= 0)
);
CREATE UNIQUE INDEX "purchase_invoice_lines_invoiceId_position_key" ON "purchase_invoice_lines"("invoiceId", "position");
CREATE UNIQUE INDEX "purchase_invoice_lines_invoiceId_stockItemId_condition_key" ON "purchase_invoice_lines"("invoiceId", "stockItemId", "condition");
CREATE INDEX "purchase_invoice_lines_merchantId_stockItemId_invoiceId_idx" ON "purchase_invoice_lines"("merchantId", "stockItemId", "invoiceId");
