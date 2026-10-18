ALTER TABLE "pos_order_checks"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "settledAt" TIMESTAMPTZ(6),
  ADD CONSTRAINT "pos_order_checks_revision_check" CHECK ("revision" > 0);

CREATE UNIQUE INDEX "storefront_orders_id_posShiftId_merchantId_key"
  ON "storefront_orders"("id", "posShiftId", "merchantId");

CREATE TABLE "pos_order_payments" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "checkId" UUID NOT NULL,
  "shiftId" UUID NOT NULL,
  "operatorEmployeeId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "method" VARCHAR(12) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "receivedAmount" DECIMAL(12,2) NOT NULL,
  "changeAmount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "terminalReference" VARCHAR(80),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_order_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_order_payments_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_payments_orderId_shiftId_merchantId_fkey"
    FOREIGN KEY ("orderId", "shiftId", "merchantId") REFERENCES "storefront_orders"("id", "posShiftId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_payments_checkId_orderId_merchantId_fkey"
    FOREIGN KEY ("checkId", "orderId", "merchantId") REFERENCES "pos_order_checks"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_payments_shiftId_merchantId_fkey"
    FOREIGN KEY ("shiftId", "merchantId") REFERENCES "pos_shifts"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_payments_operatorEmployeeId_merchantId_fkey"
    FOREIGN KEY ("operatorEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_payments_position_check" CHECK ("position" >= 0),
  CONSTRAINT "pos_order_payments_method_check" CHECK ("method" IN ('cash', 'terminal')),
  CONSTRAINT "pos_order_payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "pos_order_payments_receivedAmount_check" CHECK ("receivedAmount" > 0),
  CONSTRAINT "pos_order_payments_changeAmount_check" CHECK ("changeAmount" >= 0),
  CONSTRAINT "pos_order_payments_tender_values_check" CHECK (
    ("method" = 'cash' AND "receivedAmount" >= "amount" AND "changeAmount" = "receivedAmount" - "amount" AND "terminalReference" IS NULL)
    OR
    ("method" = 'terminal' AND "receivedAmount" = "amount" AND "changeAmount" = 0)
  )
);

CREATE UNIQUE INDEX "pos_order_payments_id_shiftId_merchantId_key"
  ON "pos_order_payments"("id", "shiftId", "merchantId");
CREATE UNIQUE INDEX "pos_order_payments_merchantId_requestId_position_key"
  ON "pos_order_payments"("merchantId", "requestId", "position");
CREATE INDEX "pos_order_payments_merchantId_orderId_checkId_createdAt_idx"
  ON "pos_order_payments"("merchantId", "orderId", "checkId", "createdAt");
CREATE INDEX "pos_order_payments_merchantId_shiftId_method_createdAt_idx"
  ON "pos_order_payments"("merchantId", "shiftId", "method", "createdAt");

CREATE TABLE "pos_shift_cash_movements" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "shiftId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "operatorEmployeeId" UUID NOT NULL,
  "kind" VARCHAR(20) NOT NULL DEFAULT 'cash_sale',
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_shift_cash_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_shift_cash_movements_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_cash_movements_shiftId_merchantId_fkey"
    FOREIGN KEY ("shiftId", "merchantId") REFERENCES "pos_shifts"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_cash_movements_paymentId_shiftId_merchantId_fkey"
    FOREIGN KEY ("paymentId", "shiftId", "merchantId") REFERENCES "pos_order_payments"("id", "shiftId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_cash_movements_operatorEmployeeId_merchantId_fkey"
    FOREIGN KEY ("operatorEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_cash_movements_kind_check" CHECK ("kind" = 'cash_sale'),
  CONSTRAINT "pos_shift_cash_movements_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "pos_shift_cash_movements_paymentId_key"
  ON "pos_shift_cash_movements"("paymentId");
CREATE UNIQUE INDEX "pos_shift_cash_movements_paymentId_shiftId_merchantId_key"
  ON "pos_shift_cash_movements"("paymentId", "shiftId", "merchantId");
CREATE INDEX "pos_shift_cash_movements_merchantId_shiftId_createdAt_idx"
  ON "pos_shift_cash_movements"("merchantId", "shiftId", "createdAt");
