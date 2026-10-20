CREATE TABLE "pos_order_refunds" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "checkId" UUID NOT NULL,
  "shiftId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "createdByEmployeeId" UUID NOT NULL,
  "approvedByEmployeeId" UUID,
  "receiptNumber" VARCHAR(40) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "issuedAt" TIMESTAMPTZ(6) NOT NULL,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "pos_order_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_order_refunds_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "pos_order_refunds_merchant_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_refunds_order_fkey" FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_refunds_check_fkey" FOREIGN KEY ("checkId", "orderId", "merchantId") REFERENCES "pos_order_checks"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_refunds_shift_fkey" FOREIGN KEY ("shiftId", "merchantId") REFERENCES "pos_shifts"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_refunds_created_by_fkey" FOREIGN KEY ("createdByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_refunds_approved_by_fkey" FOREIGN KEY ("approvedByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pos_order_refunds_merchant_request_key" ON "pos_order_refunds"("merchantId", "requestId");
CREATE UNIQUE INDEX "pos_order_refunds_merchant_receipt_key" ON "pos_order_refunds"("merchantId", "receiptNumber");
CREATE UNIQUE INDEX "pos_order_refunds_id_shift_merchant_key" ON "pos_order_refunds"("id", "shiftId", "merchantId");
CREATE INDEX "pos_order_refunds_order_check_issued_idx" ON "pos_order_refunds"("merchantId", "orderId", "checkId", "issuedAt");
CREATE INDEX "pos_order_refunds_shift_issued_idx" ON "pos_order_refunds"("merchantId", "shiftId", "issuedAt");

CREATE TABLE "pos_order_refund_tenders" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "refundId" UUID NOT NULL,
  "shiftId" UUID NOT NULL,
  "originalPaymentId" UUID NOT NULL,
  "originalPaymentShiftId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "method" VARCHAR(12) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "terminalReference" VARCHAR(80),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_order_refund_tenders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_order_refund_tenders_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "pos_order_refund_tenders_method_check" CHECK ("method" IN ('cash', 'terminal')),
  CONSTRAINT "pos_order_refund_tenders_merchant_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_refund_tenders_refund_fkey" FOREIGN KEY ("refundId", "shiftId", "merchantId") REFERENCES "pos_order_refunds"("id", "shiftId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_refund_tenders_payment_fkey" FOREIGN KEY ("originalPaymentId", "originalPaymentShiftId", "merchantId") REFERENCES "pos_order_payments"("id", "shiftId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pos_order_refund_tenders_id_shift_merchant_key" ON "pos_order_refund_tenders"("id", "shiftId", "merchantId");
CREATE UNIQUE INDEX "pos_order_refund_tenders_refund_position_key" ON "pos_order_refund_tenders"("refundId", "position");
CREATE INDEX "pos_order_refund_tenders_original_payment_idx" ON "pos_order_refund_tenders"("merchantId", "originalPaymentId", "originalPaymentShiftId");

CREATE TABLE "pos_shift_refund_movements" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "shiftId" UUID NOT NULL,
  "refundTenderId" UUID NOT NULL,
  "operatorEmployeeId" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_shift_refund_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_shift_refund_movements_negative_check" CHECK ("amount" < 0),
  CONSTRAINT "pos_shift_refund_movements_merchant_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_refund_movements_shift_fkey" FOREIGN KEY ("shiftId", "merchantId") REFERENCES "pos_shifts"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_refund_movements_tender_fkey" FOREIGN KEY ("refundTenderId", "shiftId", "merchantId") REFERENCES "pos_order_refund_tenders"("id", "shiftId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_refund_movements_operator_fkey" FOREIGN KEY ("operatorEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pos_shift_refund_movements_tender_key" ON "pos_shift_refund_movements"("refundTenderId");
CREATE UNIQUE INDEX "pos_shift_refund_movements_tender_shift_merchant_key" ON "pos_shift_refund_movements"("refundTenderId", "shiftId", "merchantId");
CREATE INDEX "pos_shift_refund_movements_shift_created_idx" ON "pos_shift_refund_movements"("merchantId", "shiftId", "createdAt");

ALTER TABLE "storefront_order_actions"
  DROP CONSTRAINT "order_action_kind",
  ADD CONSTRAINT "order_action_kind"
    CHECK ("action" IN (
      'accept', 'prepare', 'cancel', 'pos_sale', 'dining_move', 'dining_split',
      'pos_payment', 'pos_kitchen_dispatch', 'ready', 'handover', 'ready_item',
      'pos_kitchen_amendment', 'pos_cancel', 'pos_cancel_ack', 'pos_refund'
    ));
