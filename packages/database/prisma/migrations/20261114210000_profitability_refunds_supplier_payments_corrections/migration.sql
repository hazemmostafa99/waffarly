ALTER TABLE "storefront_order_lines"
ADD COLUMN "menuSectionIdAtSale" UUID,
ADD COLUMN "menuSectionNameAtSale" VARCHAR(160);

CREATE UNIQUE INDEX "pos_order_refunds_id_orderId_merchantId_key"
ON "pos_order_refunds"("id", "orderId", "merchantId");

CREATE TABLE "pos_order_refund_lines" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "refundId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "orderLineId" UUID NOT NULL,
  "productName" VARCHAR(160) NOT NULL,
  "variantName" VARCHAR(160),
  "quantity" INTEGER NOT NULL,
  "revenueReversalAmount" DECIMAL(12,2) NOT NULL,
  "originalCostAmount" DECIMAL(18,2),
  CONSTRAINT "pos_order_refund_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_order_refund_lines_refund_order_line_key" UNIQUE ("refundId", "orderLineId"),
  CONSTRAINT "pos_order_refund_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "pos_order_refund_lines_revenue_check" CHECK ("revenueReversalAmount" >= 0),
  CONSTRAINT "pos_order_refund_lines_cost_check" CHECK ("originalCostAmount" IS NULL OR "originalCostAmount" >= 0),
  CONSTRAINT "pos_order_refund_lines_refund_fkey"
    FOREIGN KEY ("refundId", "orderId", "merchantId")
    REFERENCES "pos_order_refunds"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_refund_lines_order_line_fkey"
    FOREIGN KEY ("orderLineId", "orderId", "merchantId")
    REFERENCES "storefront_order_lines"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "pos_order_refund_lines_merchantId_orderLineId_idx"
ON "pos_order_refund_lines"("merchantId", "orderLineId");

CREATE UNIQUE INDEX "pos_cash_safe_movements_id_merchantId_key"
ON "pos_cash_safe_movements"("id", "merchantId");

CREATE TABLE "purchase_supplier_payments" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paidAt" TIMESTAMPTZ(6) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" VARCHAR(160) NOT NULL,
  "safeMovementId" UUID,
  "drawerMovementId" UUID,
  "drawerShiftId" UUID,
  CONSTRAINT "purchase_supplier_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_supplier_payments_merchant_request_key" UNIQUE ("merchantId", "requestId"),
  CONSTRAINT "purchase_supplier_payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "purchase_supplier_payments_source_check" CHECK (
    ("safeMovementId" IS NOT NULL AND "drawerMovementId" IS NULL AND "drawerShiftId" IS NULL)
    OR ("safeMovementId" IS NULL AND "drawerMovementId" IS NOT NULL AND "drawerShiftId" IS NOT NULL)
  ),
  CONSTRAINT "purchase_supplier_payments_invoice_fkey"
    FOREIGN KEY ("invoiceId", "merchantId") REFERENCES "purchase_invoices"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_supplier_payments_safe_movement_fkey"
    FOREIGN KEY ("safeMovementId", "merchantId") REFERENCES "pos_cash_safe_movements"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_supplier_payments_drawer_movement_fkey"
    FOREIGN KEY ("drawerMovementId", "drawerShiftId", "merchantId") REFERENCES "pos_shift_manual_cash_movements"("id", "shiftId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "purchase_supplier_payments_merchantId_invoiceId_paidAt_id_idx"
ON "purchase_supplier_payments"("merchantId", "invoiceId", "paidAt", "id");
CREATE INDEX "purchase_supplier_payments_merchantId_safeMovementId_idx"
ON "purchase_supplier_payments"("merchantId", "safeMovementId");
CREATE INDEX "purchase_supplier_payments_merchantId_drawerMovementId_drawerShiftId_idx"
ON "purchase_supplier_payments"("merchantId", "drawerMovementId", "drawerShiftId");

CREATE TABLE "purchase_supplier_credit_notes" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "creditNumber" VARCHAR(40) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdBy" VARCHAR(160) NOT NULL,
  "issuedAt" TIMESTAMPTZ(6) NOT NULL,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "purchase_supplier_credit_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_supplier_credit_notes_request_key" UNIQUE ("merchantId", "requestId"),
  CONSTRAINT "purchase_supplier_credit_notes_number_key" UNIQUE ("merchantId", "creditNumber"),
  CONSTRAINT "purchase_supplier_credit_notes_id_merchant_key" UNIQUE ("id", "merchantId"),
  CONSTRAINT "purchase_supplier_credit_notes_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "purchase_supplier_credit_notes_invoice_fkey"
    FOREIGN KEY ("invoiceId", "merchantId") REFERENCES "purchase_invoices"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "purchase_supplier_credit_notes_merchantId_invoiceId_issuedAt_id_idx"
ON "purchase_supplier_credit_notes"("merchantId", "invoiceId", "issuedAt", "id");

CREATE TABLE "purchase_supplier_credit_note_lines" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "creditNoteId" UUID NOT NULL,
  "invoiceLineId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "stockItemName" VARCHAR(160) NOT NULL,
  "condition" VARCHAR(24) NOT NULL,
  "unitCode" VARCHAR(32) NOT NULL,
  "unitName" VARCHAR(80) NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "creditAmount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "purchase_supplier_credit_note_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_supplier_credit_note_lines_note_item_key" UNIQUE ("creditNoteId", "invoiceLineId"),
  CONSTRAINT "purchase_supplier_credit_note_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "purchase_supplier_credit_note_lines_amount_check" CHECK ("creditAmount" >= 0),
  CONSTRAINT "purchase_supplier_credit_note_lines_line_fkey"
    FOREIGN KEY ("invoiceLineId", "merchantId") REFERENCES "purchase_invoice_lines"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_supplier_credit_note_lines_item_fkey"
    FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_supplier_credit_note_lines_note_fkey"
    FOREIGN KEY ("creditNoteId", "merchantId") REFERENCES "purchase_supplier_credit_notes"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "purchase_supplier_credit_note_lines_merchantId_invoiceLineId_idx"
ON "purchase_supplier_credit_note_lines"("merchantId", "invoiceLineId");

CREATE TABLE "purchase_invoice_corrections" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" VARCHAR(160) NOT NULL,
  "issuedAt" TIMESTAMPTZ(6) NOT NULL,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "purchase_invoice_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoice_corrections_request_key" UNIQUE ("merchantId", "requestId"),
  CONSTRAINT "purchase_invoice_corrections_id_merchant_key" UNIQUE ("id", "merchantId"),
  CONSTRAINT "purchase_invoice_corrections_invoice_fkey"
    FOREIGN KEY ("invoiceId", "merchantId") REFERENCES "purchase_invoices"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "purchase_invoice_corrections_merchantId_invoiceId_issuedAt_id_idx"
ON "purchase_invoice_corrections"("merchantId", "invoiceId", "issuedAt", "id");

CREATE TABLE "purchase_invoice_correction_lines" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "correctionId" UUID NOT NULL,
  "invoiceLineId" UUID NOT NULL,
  "stockItemId" UUID NOT NULL,
  "originalUnitCost" DECIMAL(18,2) NOT NULL,
  "correctedUnitCost" DECIMAL(18,2) NOT NULL,
  CONSTRAINT "purchase_invoice_correction_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoice_correction_lines_correction_item_key" UNIQUE ("correctionId", "invoiceLineId"),
  CONSTRAINT "purchase_invoice_correction_lines_cost_check" CHECK ("originalUnitCost" > 0 AND "correctedUnitCost" > 0),
  CONSTRAINT "purchase_invoice_correction_lines_correction_fkey"
    FOREIGN KEY ("correctionId", "merchantId") REFERENCES "purchase_invoice_corrections"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoice_correction_lines_line_fkey"
    FOREIGN KEY ("invoiceLineId", "merchantId") REFERENCES "purchase_invoice_lines"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_invoice_correction_lines_item_fkey"
    FOREIGN KEY ("stockItemId", "merchantId") REFERENCES "stock_items"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "purchase_invoice_correction_lines_merchantId_stockItemId_idx"
ON "purchase_invoice_correction_lines"("merchantId", "stockItemId");
