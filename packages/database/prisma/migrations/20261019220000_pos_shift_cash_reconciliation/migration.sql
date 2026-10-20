CREATE TABLE "pos_shift_manual_cash_movements" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "shiftId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "kind" VARCHAR(12) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "operatorEmployeeId" UUID NOT NULL,
  "approvedByEmployeeId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_shift_manual_cash_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_shift_manual_cash_movements_kind_check" CHECK ("kind" IN ('cash_in', 'cash_out')),
  CONSTRAINT "pos_shift_manual_cash_movements_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "pos_shift_manual_cash_movements_merchant_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_manual_cash_movements_shift_fkey"
    FOREIGN KEY ("shiftId", "merchantId") REFERENCES "pos_shifts"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_manual_cash_movements_operator_fkey"
    FOREIGN KEY ("operatorEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_manual_cash_movements_approver_fkey"
    FOREIGN KEY ("approvedByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pos_shift_manual_cash_movements_merchant_request_key"
  ON "pos_shift_manual_cash_movements"("merchantId", "requestId");
CREATE UNIQUE INDEX "pos_shift_manual_cash_movements_id_shift_merchant_key"
  ON "pos_shift_manual_cash_movements"("id", "shiftId", "merchantId");
CREATE INDEX "pos_shift_manual_cash_movements_shift_created_idx"
  ON "pos_shift_manual_cash_movements"("merchantId", "shiftId", "createdAt");

CREATE TABLE "pos_shift_close_reports" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "shiftId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "operatorEmployeeId" UUID NOT NULL,
  "approvedByEmployeeId" UUID,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "openingFloat" DECIMAL(12,2) NOT NULL,
  "cashSales" DECIMAL(12,2) NOT NULL,
  "cashRefunds" DECIMAL(12,2) NOT NULL,
  "cashIn" DECIMAL(12,2) NOT NULL,
  "cashOut" DECIMAL(12,2) NOT NULL,
  "expectedCash" DECIMAL(12,2) NOT NULL,
  "countedCash" DECIMAL(12,2) NOT NULL,
  "variance" DECIMAL(12,2) NOT NULL,
  "terminalSales" DECIMAL(12,2) NOT NULL,
  "terminalRefunds" DECIMAL(12,2) NOT NULL,
  "reason" VARCHAR(500),
  "snapshot" JSONB NOT NULL,
  "closedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "pos_shift_close_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_shift_close_reports_merchant_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_close_reports_shift_fkey"
    FOREIGN KEY ("shiftId", "merchantId") REFERENCES "pos_shifts"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_close_reports_operator_fkey"
    FOREIGN KEY ("operatorEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shift_close_reports_approver_fkey"
    FOREIGN KEY ("approvedByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pos_shift_close_reports_shift_merchant_key"
  ON "pos_shift_close_reports"("shiftId", "merchantId");
CREATE UNIQUE INDEX "pos_shift_close_reports_merchant_request_key"
  ON "pos_shift_close_reports"("merchantId", "requestId");
CREATE INDEX "pos_shift_close_reports_merchant_closed_idx"
  ON "pos_shift_close_reports"("merchantId", "closedAt", "shiftId");
