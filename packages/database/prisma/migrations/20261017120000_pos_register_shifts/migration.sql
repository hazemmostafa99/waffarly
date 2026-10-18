ALTER TABLE "pos_employees"
  ADD COLUMN "role" VARCHAR(24),
  ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Preserve the capabilities the POS currently grants to every active employee;
-- new sales and register permissions are assigned only when an owner chooses a role.
UPDATE "pos_employees"
SET "permissions" = ARRAY['accept_recipe_orders', 'start_preparation']::TEXT[];

ALTER TABLE "pos_employees"
  ADD CONSTRAINT "pos_employees_role_check"
    CHECK ("role" IS NULL OR "role" IN ('cashier', 'supervisor')),
  ADD CONSTRAINT "pos_employees_permissions_check"
    CHECK ("permissions" <@ ARRAY[
      'accept_recipe_orders',
      'start_preparation',
      'open_register_shift',
      'sell',
      'approve_discounts',
      'approve_voids',
      'approve_refunds'
    ]::TEXT[]);

CREATE TABLE "pos_registers" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "pos_registers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_registers_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_registers_branchId_merchantId_fkey"
    FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_registers_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "pos_registers_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "pos_registers_id_merchantId_key"
  ON "pos_registers"("id", "merchantId");
CREATE UNIQUE INDEX "pos_registers_id_branchId_merchantId_key"
  ON "pos_registers"("id", "branchId", "merchantId");
CREATE UNIQUE INDEX "pos_registers_branchId_name_key"
  ON "pos_registers"("branchId", "name");
CREATE INDEX "pos_registers_merchantId_branchId_active_createdAt_id_idx"
  ON "pos_registers"("merchantId", "branchId", "active", "createdAt", "id");

CREATE TABLE "pos_shifts" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "registerId" UUID NOT NULL,
  "openRequestId" UUID NOT NULL,
  "openedByEmployeeId" UUID NOT NULL,
  "openingFloat" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EGP',
  "status" VARCHAR(12) NOT NULL DEFAULT 'open',
  "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(6),
  CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_shifts_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shifts_branchId_merchantId_fkey"
    FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shifts_registerId_branchId_merchantId_fkey"
    FOREIGN KEY ("registerId", "branchId", "merchantId") REFERENCES "pos_registers"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shifts_openedByEmployeeId_merchantId_fkey"
    FOREIGN KEY ("openedByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_shifts_openingFloat_check" CHECK ("openingFloat" >= 0),
  CONSTRAINT "pos_shifts_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "pos_shifts_status_check" CHECK ("status" IN ('open', 'closing', 'closed')),
  CONSTRAINT "pos_shifts_closedAt_check" CHECK (("status" IN ('open', 'closing') AND "closedAt" IS NULL) OR ("status" = 'closed' AND "closedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "pos_shifts_id_merchantId_key"
  ON "pos_shifts"("id", "merchantId");
CREATE UNIQUE INDEX "pos_shifts_merchantId_openRequestId_key"
  ON "pos_shifts"("merchantId", "openRequestId");
CREATE UNIQUE INDEX "pos_shifts_one_open_per_register_key"
  ON "pos_shifts"("registerId") WHERE "status" IN ('open', 'closing');
CREATE INDEX "pos_shifts_merchantId_registerId_status_openedAt_idx"
  ON "pos_shifts"("merchantId", "registerId", "status", "openedAt");
CREATE INDEX "pos_shifts_merchantId_openedByEmployeeId_openedAt_idx"
  ON "pos_shifts"("merchantId", "openedByEmployeeId", "openedAt");
