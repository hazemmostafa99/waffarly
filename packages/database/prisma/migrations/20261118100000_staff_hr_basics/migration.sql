ALTER TABLE "pos_cash_safe_movements"
  ADD COLUMN "purpose" VARCHAR(32),
  ADD CONSTRAINT "pos_cash_safe_movements_purpose_check"
    CHECK ("purpose" IS NULL OR "purpose" IN ('hr_advance', 'hr_payroll', 'hr_expense'));

CREATE TABLE "staff_members" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "posEmployeeId" UUID,
  "employeeNumber" VARCHAR(40),
  "displayName" VARCHAR(160) NOT NULL,
  "jobTitle" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(32),
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_members_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "staff_members_endDate_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate"),
  CONSTRAINT "staff_members_inactive_endDate_check" CHECK ("active" OR "endDate" IS NOT NULL),
  CONSTRAINT "staff_members_id_merchantId_key" UNIQUE ("id", "merchantId"),
  CONSTRAINT "staff_members_id_branchId_merchantId_key" UNIQUE ("id", "branchId", "merchantId"),
  CONSTRAINT "staff_members_merchantId_employeeNumber_key" UNIQUE ("merchantId", "employeeNumber"),
  CONSTRAINT "staff_members_posEmployeeId_merchantId_key" UNIQUE ("posEmployeeId", "merchantId"),
  CONSTRAINT "staff_members_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_members_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId")
    REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_members_posEmployeeId_merchantId_fkey" FOREIGN KEY ("posEmployeeId", "merchantId")
    REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_members_merchantId_branchId_active_displayName_id_idx"
  ON "staff_members"("merchantId", "branchId", "active", "displayName", "id");

CREATE TABLE "staff_pay_rates" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "staffMemberId" UUID NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "basis" VARCHAR(12) NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_pay_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_pay_rates_basis_check" CHECK ("basis" IN ('monthly', 'daily')),
  CONSTRAINT "staff_pay_rates_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "staff_pay_rates_merchantId_staffMemberId_effectiveDate_key"
    UNIQUE ("merchantId", "staffMemberId", "effectiveDate"),
  CONSTRAINT "staff_pay_rates_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("staffMemberId", "merchantId") REFERENCES "staff_members"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_pay_rates_merchantId_staffMemberId_effectiveDate_idx"
  ON "staff_pay_rates"("merchantId", "staffMemberId", "effectiveDate");

CREATE TABLE "attendance_periods" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "monthStart" DATE NOT NULL,
  "status" VARCHAR(12) NOT NULL DEFAULT 'draft',
  "createdBy" VARCHAR(80) NOT NULL,
  "approvedBy" VARCHAR(80),
  "approvedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_periods_status_check" CHECK ("status" IN ('draft', 'approved')),
  CONSTRAINT "attendance_periods_monthStart_check"
    CHECK (EXTRACT(DAY FROM "monthStart") = 1),
  CONSTRAINT "attendance_periods_id_merchantId_key" UNIQUE ("id", "merchantId"),
  CONSTRAINT "attendance_periods_merchantId_monthStart_key" UNIQUE ("merchantId", "monthStart"),
  CONSTRAINT "attendance_periods_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "attendance_periods_merchantId_status_monthStart_idx"
  ON "attendance_periods"("merchantId", "status", "monthStart");

CREATE TABLE "staff_attendance" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "attendancePeriodId" UUID NOT NULL,
  "staffMemberId" UUID NOT NULL,
  "attendanceDate" DATE NOT NULL,
  "status" VARCHAR(12) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_attendance_status_check" CHECK ("status" IN ('present', 'absent', 'leave', 'rest')),
  CONSTRAINT "staff_attendance_merchantId_staffMemberId_attendanceDate_key"
    UNIQUE ("merchantId", "staffMemberId", "attendanceDate"),
  CONSTRAINT "staff_attendance_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_attendance_attendancePeriodId_merchantId_fkey"
    FOREIGN KEY ("attendancePeriodId", "merchantId") REFERENCES "attendance_periods"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_attendance_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("staffMemberId", "merchantId") REFERENCES "staff_members"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_attendance_merchantId_attendancePeriodId_attendanceDate_idx"
  ON "staff_attendance"("merchantId", "attendancePeriodId", "attendanceDate");

CREATE TABLE "staff_attendance_changes" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "attendancePeriodId" UUID NOT NULL,
  "staffMemberId" UUID NOT NULL,
  "attendanceDate" DATE NOT NULL,
  "previousStatus" VARCHAR(12),
  "newStatus" VARCHAR(12),
  "reason" VARCHAR(500) NOT NULL,
  "changedBy" VARCHAR(80) NOT NULL,
  "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_attendance_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_attendance_changes_previousStatus_check"
    CHECK ("previousStatus" IS NULL OR "previousStatus" IN ('present', 'absent', 'leave', 'rest')),
  CONSTRAINT "staff_attendance_changes_newStatus_check"
    CHECK ("newStatus" IS NULL OR "newStatus" IN ('present', 'absent', 'leave', 'rest')),
  CONSTRAINT "staff_attendance_changes_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_attendance_changes_attendancePeriodId_merchantId_fkey"
    FOREIGN KEY ("attendancePeriodId", "merchantId") REFERENCES "attendance_periods"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_attendance_changes_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("staffMemberId", "merchantId") REFERENCES "staff_members"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_attendance_changes_merchantId_staffMemberId_attendanceDate_changedAt_idx"
  ON "staff_attendance_changes"("merchantId", "staffMemberId", "attendanceDate", "changedAt");

CREATE TABLE "staff_payroll_runs" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "attendancePeriodId" UUID NOT NULL,
  "monthStart" DATE NOT NULL,
  "status" VARCHAR(12) NOT NULL DEFAULT 'draft',
  "createdBy" VARCHAR(80) NOT NULL,
  "approvedBy" VARCHAR(80),
  "approvedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_payroll_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_payroll_runs_status_check" CHECK ("status" IN ('draft', 'approved', 'paid')),
  CONSTRAINT "staff_payroll_runs_monthStart_check" CHECK (EXTRACT(DAY FROM "monthStart") = 1),
  CONSTRAINT "staff_payroll_runs_id_merchantId_key" UNIQUE ("id", "merchantId"),
  CONSTRAINT "staff_payroll_runs_merchantId_monthStart_key" UNIQUE ("merchantId", "monthStart"),
  CONSTRAINT "staff_payroll_runs_attendancePeriodId_merchantId_key" UNIQUE ("attendancePeriodId", "merchantId"),
  CONSTRAINT "staff_payroll_runs_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_runs_attendancePeriodId_merchantId_fkey"
    FOREIGN KEY ("attendancePeriodId", "merchantId") REFERENCES "attendance_periods"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_payroll_runs_merchantId_status_monthStart_idx"
  ON "staff_payroll_runs"("merchantId", "status", "monthStart");

CREATE TABLE "staff_payroll_adjustments" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "payrollRunId" UUID NOT NULL,
  "staffMemberId" UUID NOT NULL,
  "kind" VARCHAR(12) NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_payroll_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_payroll_adjustments_kind_check" CHECK ("kind" IN ('addition', 'deduction')),
  CONSTRAINT "staff_payroll_adjustments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "staff_payroll_adjustments_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_adjustments_payrollRunId_merchantId_fkey"
    FOREIGN KEY ("payrollRunId", "merchantId") REFERENCES "staff_payroll_runs"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_adjustments_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("staffMemberId", "merchantId") REFERENCES "staff_members"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_payroll_adjustments_merchantId_payrollRunId_staffMemberId_idx"
  ON "staff_payroll_adjustments"("merchantId", "payrollRunId", "staffMemberId");

CREATE TABLE "staff_payroll_lines" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "payrollRunId" UUID NOT NULL,
  "staffMemberId" UUID NOT NULL,
  "employeeName" VARCHAR(160) NOT NULL,
  "branchName" VARCHAR(160) NOT NULL,
  "branchId" UUID NOT NULL,
  "payBasis" VARCHAR(12) NOT NULL,
  "presentDays" INTEGER NOT NULL DEFAULT 0,
  "basePay" DECIMAL(12, 2) NOT NULL,
  "additions" DECIMAL(12, 2) NOT NULL,
  "deductions" DECIMAL(12, 2) NOT NULL,
  "advanceDeduction" DECIMAL(12, 2) NOT NULL,
  "netDue" DECIMAL(12, 2) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_payroll_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_payroll_lines_payBasis_check" CHECK ("payBasis" IN ('monthly', 'daily')),
  CONSTRAINT "staff_payroll_lines_presentDays_check" CHECK ("presentDays" >= 0),
  CONSTRAINT "staff_payroll_lines_nonnegative_amounts_check"
    CHECK ("basePay" >= 0 AND "additions" >= 0 AND "deductions" >= 0 AND "advanceDeduction" >= 0 AND "netDue" >= 0),
  CONSTRAINT "staff_payroll_lines_id_staffMemberId_merchantId_key" UNIQUE ("id", "staffMemberId", "merchantId"),
  CONSTRAINT "staff_payroll_lines_payrollRunId_staffMemberId_key" UNIQUE ("payrollRunId", "staffMemberId"),
  CONSTRAINT "staff_payroll_lines_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_lines_payrollRunId_merchantId_fkey"
    FOREIGN KEY ("payrollRunId", "merchantId") REFERENCES "staff_payroll_runs"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_lines_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("staffMemberId", "merchantId") REFERENCES "staff_members"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_lines_branchId_merchantId_fkey"
    FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_payroll_lines_merchantId_payrollRunId_staffMemberId_idx"
  ON "staff_payroll_lines"("merchantId", "payrollRunId", "staffMemberId");

CREATE TABLE "staff_advances" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "staffMemberId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "cashMovementId" UUID NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "installmentAmount" DECIMAL(12, 2) NOT NULL,
  "firstInstallmentMonth" DATE NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_advances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_advances_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "staff_advances_installmentAmount_check" CHECK ("installmentAmount" > 0),
  CONSTRAINT "staff_advances_firstInstallmentMonth_check" CHECK (EXTRACT(DAY FROM "firstInstallmentMonth") = 1),
  CONSTRAINT "staff_advances_id_staffMemberId_merchantId_key" UNIQUE ("id", "staffMemberId", "merchantId"),
  CONSTRAINT "staff_advances_merchantId_requestId_key" UNIQUE ("merchantId", "requestId"),
  CONSTRAINT "staff_advances_cashMovementId_merchantId_key" UNIQUE ("cashMovementId", "merchantId"),
  CONSTRAINT "staff_advances_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_advances_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("staffMemberId", "merchantId") REFERENCES "staff_members"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_advances_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId")
    REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_advances_cashMovementId_merchantId_fkey" FOREIGN KEY ("cashMovementId", "merchantId")
    REFERENCES "pos_cash_safe_movements"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_advances_merchantId_staffMemberId_firstInstallmentMonth_createdAt_idx"
  ON "staff_advances"("merchantId", "staffMemberId", "firstInstallmentMonth", "createdAt");

CREATE TABLE "staff_advance_repayments" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "advanceId" UUID NOT NULL,
  "payrollLineId" UUID NOT NULL,
  "staffMemberId" UUID NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_advance_repayments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_advance_repayments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "staff_advance_repayments_advanceId_payrollLineId_key" UNIQUE ("advanceId", "payrollLineId"),
  CONSTRAINT "staff_advance_repayments_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_advance_repayments_advanceId_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("advanceId", "staffMemberId", "merchantId") REFERENCES "staff_advances"("id", "staffMemberId", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_advance_repayments_payrollLineId_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("payrollLineId", "staffMemberId", "merchantId") REFERENCES "staff_payroll_lines"("id", "staffMemberId", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_advance_repayments_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("staffMemberId", "merchantId") REFERENCES "staff_members"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_advance_repayments_merchantId_staffMemberId_createdAt_idx"
  ON "staff_advance_repayments"("merchantId", "staffMemberId", "createdAt");

CREATE TABLE "staff_payroll_payments" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "payrollLineId" UUID NOT NULL,
  "staffMemberId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "cashMovementId" UUID NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "paidAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_payroll_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_payroll_payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "staff_payroll_payments_merchantId_requestId_key" UNIQUE ("merchantId", "requestId"),
  CONSTRAINT "staff_payroll_payments_cashMovementId_merchantId_key" UNIQUE ("cashMovementId", "merchantId"),
  CONSTRAINT "staff_payroll_payments_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_payments_payrollLineId_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("payrollLineId", "staffMemberId", "merchantId") REFERENCES "staff_payroll_lines"("id", "staffMemberId", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_payments_staffMemberId_merchantId_fkey"
    FOREIGN KEY ("staffMemberId", "merchantId") REFERENCES "staff_members"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "staff_payroll_payments_cashMovementId_merchantId_fkey"
    FOREIGN KEY ("cashMovementId", "merchantId") REFERENCES "pos_cash_safe_movements"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "staff_payroll_payments_merchantId_payrollLineId_paidAt_idx"
  ON "staff_payroll_payments"("merchantId", "payrollLineId", "paidAt");

CREATE TABLE "merchant_expenses" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "incurredOn" DATE NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "receiptStorageKey" VARCHAR(500),
  "receiptMimeType" VARCHAR(80),
  "receiptSizeBytes" INTEGER,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "merchant_expenses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "merchant_expenses_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "merchant_expenses_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "merchant_expenses_receipt_metadata_check" CHECK (
    ("receiptStorageKey" IS NULL AND "receiptMimeType" IS NULL AND "receiptSizeBytes" IS NULL)
    OR ("receiptStorageKey" IS NOT NULL AND "receiptMimeType" IN ('image/jpeg', 'image/png', 'image/webp')
      AND "receiptSizeBytes" > 0)
  ),
  CONSTRAINT "merchant_expenses_id_merchantId_key" UNIQUE ("id", "merchantId"),
  CONSTRAINT "merchant_expenses_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "merchant_expenses_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId")
    REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "merchant_expenses_merchantId_branchId_incurredOn_id_idx"
  ON "merchant_expenses"("merchantId", "branchId", "incurredOn", "id");

CREATE TABLE "expense_payments" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "expenseId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "cashMovementId" UUID NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "paidAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" VARCHAR(500) NOT NULL,
  "createdBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "expense_payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "expense_payments_merchantId_requestId_key" UNIQUE ("merchantId", "requestId"),
  CONSTRAINT "expense_payments_cashMovementId_merchantId_key" UNIQUE ("cashMovementId", "merchantId"),
  CONSTRAINT "expense_payments_merchantId_fkey" FOREIGN KEY ("merchantId")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "expense_payments_expenseId_merchantId_fkey" FOREIGN KEY ("expenseId", "merchantId")
    REFERENCES "merchant_expenses"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "expense_payments_cashMovementId_merchantId_fkey" FOREIGN KEY ("cashMovementId", "merchantId")
    REFERENCES "pos_cash_safe_movements"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "expense_payments_merchantId_expenseId_paidAt_idx"
  ON "expense_payments"("merchantId", "expenseId", "paidAt");
