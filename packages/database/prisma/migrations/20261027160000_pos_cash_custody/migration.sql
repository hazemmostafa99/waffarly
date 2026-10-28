CREATE TABLE "pos_cash_safes" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "createdBy" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_safes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_cash_transfers" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "sourceShiftId" UUID NOT NULL,
    "destinationSafeId" UUID,
    "destinationShiftId" UUID,
    "manualMovementId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedAmount" DECIMAL(12,2),
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "reference" VARCHAR(80) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdBy" VARCHAR(160) NOT NULL,
    "receivedBy" VARCHAR(160),
    "receivedAt" TIMESTAMPTZ(6),
    "receiptRequestId" UUID,
    "receiptFingerprint" VARCHAR(64),
    "receiptNote" VARCHAR(500),
    "resolvedBy" VARCHAR(160),
    "resolutionNote" VARCHAR(500),
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_cash_safe_movements" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "safeId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "transferId" UUID,
    "kind" VARCHAR(16) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdBy" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_safe_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_cash_safes_id_branchId_merchantId_key" ON "pos_cash_safes"("id", "branchId", "merchantId");

CREATE UNIQUE INDEX "pos_cash_safes_merchantId_branchId_name_key" ON "pos_cash_safes"("merchantId", "branchId", "name");

CREATE UNIQUE INDEX "pos_cash_transfers_destinationShiftId_key" ON "pos_cash_transfers"("destinationShiftId");

CREATE UNIQUE INDEX "pos_cash_transfers_manualMovementId_key" ON "pos_cash_transfers"("manualMovementId");

CREATE INDEX "pos_cash_transfers_merchantId_branchId_createdAt_id_idx" ON "pos_cash_transfers"("merchantId", "branchId", "createdAt", "id");

CREATE UNIQUE INDEX "pos_cash_transfers_destinationShiftId_branchId_merchantId_key" ON "pos_cash_transfers"("destinationShiftId", "branchId", "merchantId");

CREATE UNIQUE INDEX "pos_cash_transfers_manualMovementId_sourceShiftId_merchantI_key" ON "pos_cash_transfers"("manualMovementId", "sourceShiftId", "merchantId");

CREATE UNIQUE INDEX "pos_cash_transfers_id_merchantId_key" ON "pos_cash_transfers"("id", "merchantId");

CREATE UNIQUE INDEX "pos_cash_transfers_merchantId_requestId_key" ON "pos_cash_transfers"("merchantId", "requestId");

CREATE UNIQUE INDEX "pos_cash_transfers_merchantId_receiptRequestId_key" ON "pos_cash_transfers"("merchantId", "receiptRequestId");

CREATE UNIQUE INDEX "pos_cash_safe_movements_transferId_key" ON "pos_cash_safe_movements"("transferId");

CREATE INDEX "pos_cash_safe_movements_merchantId_safeId_createdAt_id_idx" ON "pos_cash_safe_movements"("merchantId", "safeId", "createdAt", "id");

CREATE UNIQUE INDEX "pos_cash_safe_movements_transferId_merchantId_key" ON "pos_cash_safe_movements"("transferId", "merchantId");

CREATE UNIQUE INDEX "pos_cash_safe_movements_merchantId_requestId_key" ON "pos_cash_safe_movements"("merchantId", "requestId");

ALTER TABLE "pos_cash_safes" ADD CONSTRAINT "pos_cash_safes_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_safes" ADD CONSTRAINT "pos_cash_safes_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_transfers" ADD CONSTRAINT "pos_cash_transfers_sourceShiftId_branchId_merchantId_fkey" FOREIGN KEY ("sourceShiftId", "branchId", "merchantId") REFERENCES "pos_shifts"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_transfers" ADD CONSTRAINT "pos_cash_transfers_destinationShiftId_branchId_merchantId_fkey" FOREIGN KEY ("destinationShiftId", "branchId", "merchantId") REFERENCES "pos_shifts"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_transfers" ADD CONSTRAINT "pos_cash_transfers_destinationSafeId_branchId_merchantId_fkey" FOREIGN KEY ("destinationSafeId", "branchId", "merchantId") REFERENCES "pos_cash_safes"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_transfers" ADD CONSTRAINT "pos_cash_transfers_manualMovementId_sourceShiftId_merchant_fkey" FOREIGN KEY ("manualMovementId", "sourceShiftId", "merchantId") REFERENCES "pos_shift_manual_cash_movements"("id", "shiftId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_safe_movements" ADD CONSTRAINT "pos_cash_safe_movements_safeId_branchId_merchantId_fkey" FOREIGN KEY ("safeId", "branchId", "merchantId") REFERENCES "pos_cash_safes"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_safe_movements" ADD CONSTRAINT "pos_cash_safe_movements_transferId_merchantId_fkey" FOREIGN KEY ("transferId", "merchantId") REFERENCES "pos_cash_transfers"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_cash_transfers" ADD CONSTRAINT "cash_transfer_destination_check" CHECK (("destinationSafeId" IS NOT NULL)::int + ("destinationShiftId" IS NOT NULL)::int = 1);
ALTER TABLE "pos_cash_transfers" ADD CONSTRAINT "cash_transfer_amount_check" CHECK ("amount" > 0 AND ("receivedAmount" IS NULL OR "receivedAmount" >= 0));
ALTER TABLE "pos_cash_transfers" ADD CONSTRAINT "cash_transfer_state_check" CHECK ("status" IN ('pending','received','discrepancy','resolved') AND (("status" = 'pending' AND "receivedAmount" IS NULL AND "receivedAt" IS NULL AND "receivedBy" IS NULL) OR ("status" <> 'pending' AND "receivedAmount" IS NOT NULL AND "receivedAt" IS NOT NULL AND "receivedBy" IS NOT NULL)));
ALTER TABLE "pos_cash_transfers" ADD CONSTRAINT "cash_transfer_carryover_check" CHECK ("destinationShiftId" IS NULL OR ("manualMovementId" IS NULL AND "destinationShiftId" <> "sourceShiftId" AND "status" = 'received' AND "receivedAmount" = "amount"));
ALTER TABLE "pos_cash_safe_movements" ADD CONSTRAINT "cash_safe_movement_kind_check" CHECK (("kind" IN ('opening','receipt') AND "amount" >= 0) OR ("kind" = 'deposit' AND "amount" > 0) OR ("kind" = 'withdrawal' AND "amount" < 0));
