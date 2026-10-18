ALTER TABLE "storefront_orders"
  ADD COLUMN "posDiningSessionId" UUID,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "storefront_orders_revision_check" CHECK ("revision" > 0);

CREATE TABLE "pos_dining_tables" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 2,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "pos_dining_tables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_dining_tables_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_dining_tables_branchId_merchantId_fkey"
    FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_dining_tables_code_check" CHECK (length(btrim("code")) > 0),
  CONSTRAINT "pos_dining_tables_capacity_check" CHECK ("capacity" BETWEEN 1 AND 100),
  CONSTRAINT "pos_dining_tables_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "pos_dining_tables_id_branchId_merchantId_key"
  ON "pos_dining_tables"("id", "branchId", "merchantId");
CREATE UNIQUE INDEX "pos_dining_tables_branchId_code_key"
  ON "pos_dining_tables"("branchId", "code");
CREATE INDEX "pos_dining_tables_merchantId_branchId_active_code_idx"
  ON "pos_dining_tables"("merchantId", "branchId", "active", "code");

CREATE TABLE "pos_dining_sessions" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "tableId" UUID NOT NULL,
  "openedByEmployeeId" UUID NOT NULL,
  "status" VARCHAR(12) NOT NULL DEFAULT 'open',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(6),
  CONSTRAINT "pos_dining_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_dining_sessions_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_dining_sessions_branchId_merchantId_fkey"
    FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_dining_sessions_tableId_branchId_merchantId_fkey"
    FOREIGN KEY ("tableId", "branchId", "merchantId") REFERENCES "pos_dining_tables"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_dining_sessions_openedByEmployeeId_merchantId_fkey"
    FOREIGN KEY ("openedByEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_dining_sessions_status_check" CHECK ("status" IN ('open', 'closed')),
  CONSTRAINT "pos_dining_sessions_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "pos_dining_sessions_closedAt_check"
    CHECK (("status" = 'open' AND "closedAt" IS NULL) OR ("status" = 'closed' AND "closedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "pos_dining_sessions_id_merchantId_key"
  ON "pos_dining_sessions"("id", "merchantId");
CREATE UNIQUE INDEX "pos_dining_sessions_id_branchId_merchantId_key"
  ON "pos_dining_sessions"("id", "branchId", "merchantId");
CREATE UNIQUE INDEX "pos_dining_sessions_one_open_per_table_key"
  ON "pos_dining_sessions"("tableId") WHERE "status" = 'open';
CREATE INDEX "pos_dining_sessions_merchantId_branchId_status_openedAt_idx"
  ON "pos_dining_sessions"("merchantId", "branchId", "status", "openedAt");
CREATE INDEX "pos_dining_sessions_merchantId_tableId_status_idx"
  ON "pos_dining_sessions"("merchantId", "tableId", "status");

ALTER TABLE "storefront_orders"
  ADD CONSTRAINT "storefront_orders_posDiningSessionId_branchId_merchantId_fkey"
    FOREIGN KEY ("posDiningSessionId", "branchId", "merchantId") REFERENCES "pos_dining_sessions"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "storefront_orders_merchantId_posDiningSessionId_createdAt_idx"
  ON "storefront_orders"("merchantId", "posDiningSessionId", "createdAt");

ALTER TABLE "storefront_order_lines"
  ADD CONSTRAINT "storefront_order_lines_id_orderId_merchantId_key" UNIQUE ("id", "orderId", "merchantId");

CREATE TABLE "pos_order_checks" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "splitMethod" VARCHAR(12) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_order_checks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_order_checks_orderId_merchantId_fkey"
    FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_checks_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_checks_position_check" CHECK ("position" >= 0),
  CONSTRAINT "pos_order_checks_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "pos_order_checks_splitMethod_check" CHECK ("splitMethod" IN ('whole', 'items', 'equal', 'custom'))
);

CREATE UNIQUE INDEX "pos_order_checks_id_orderId_merchantId_key"
  ON "pos_order_checks"("id", "orderId", "merchantId");
CREATE UNIQUE INDEX "pos_order_checks_orderId_position_key"
  ON "pos_order_checks"("orderId", "position");
CREATE INDEX "pos_order_checks_merchantId_orderId_position_idx"
  ON "pos_order_checks"("merchantId", "orderId", "position");

CREATE TABLE "pos_order_check_lines" (
  "id" UUID NOT NULL,
  "checkId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "orderLineId" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "pos_order_check_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_order_check_lines_checkId_orderId_merchantId_fkey"
    FOREIGN KEY ("checkId", "orderId", "merchantId") REFERENCES "pos_order_checks"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_check_lines_orderLineId_orderId_merchantId_fkey"
    FOREIGN KEY ("orderLineId", "orderId", "merchantId") REFERENCES "storefront_order_lines"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_order_check_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "pos_order_check_lines_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "pos_order_check_lines_checkId_orderLineId_key"
  ON "pos_order_check_lines"("checkId", "orderLineId");
CREATE INDEX "pos_order_check_lines_merchantId_orderLineId_idx"
  ON "pos_order_check_lines"("merchantId", "orderLineId");

ALTER TABLE "storefront_order_actions"
  DROP CONSTRAINT "order_action_kind",
  ADD CONSTRAINT "order_action_kind"
    CHECK ("action" IN ('accept', 'prepare', 'cancel', 'pos_sale', 'dining_move', 'dining_split'));
