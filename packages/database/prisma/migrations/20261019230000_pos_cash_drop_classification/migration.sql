ALTER TABLE "pos_shift_manual_cash_movements"
  DROP CONSTRAINT "pos_shift_manual_cash_movements_kind_check",
  ADD COLUMN "dropReference" VARCHAR(80),
  ADD CONSTRAINT "pos_shift_manual_cash_movements_kind_check"
    CHECK ("kind" IN ('cash_in', 'cash_out', 'cash_drop'));

ALTER TABLE "pos_shift_close_reports"
  ADD COLUMN "cashDrop" DECIMAL(12,2) NOT NULL DEFAULT 0;
