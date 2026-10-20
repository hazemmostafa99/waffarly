-- Each branch starts with one kitchen station. POS takeaway and delivery are
-- ticketed at sale confirmation; dine-in rounds are ticketed by an explicit action.
ALTER TABLE "storefront_orders"
  ADD CONSTRAINT "storefront_orders_id_branchId_merchantId_key"
  UNIQUE ("id", "branchId", "merchantId");

CREATE TABLE "pos_kitchen_stations" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "code" VARCHAR(48) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "pos_kitchen_stations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pos_kitchen_tickets" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "stationId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "dispatchMode" VARCHAR(16) NOT NULL,
  "dispatchedByPosEmployeeId" UUID,
  "dispatchedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_kitchen_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_kitchen_tickets_dispatchMode_check"
    CHECK ("dispatchMode" IN ('automatic', 'manual', 'legacy'))
);

CREATE UNIQUE INDEX "pos_kitchen_stations_id_merchantId_key"
  ON "pos_kitchen_stations"("id", "merchantId");
CREATE UNIQUE INDEX "pos_kitchen_stations_id_branchId_merchantId_key"
  ON "pos_kitchen_stations"("id", "branchId", "merchantId");
CREATE UNIQUE INDEX "pos_kitchen_stations_merchantId_branchId_code_key"
  ON "pos_kitchen_stations"("merchantId", "branchId", "code");
CREATE INDEX "pos_kitchen_stations_merchantId_branchId_active_idx"
  ON "pos_kitchen_stations"("merchantId", "branchId", "active");

CREATE UNIQUE INDEX "pos_kitchen_tickets_id_merchantId_key"
  ON "pos_kitchen_tickets"("id", "merchantId");
CREATE UNIQUE INDEX "pos_kitchen_tickets_orderId_merchantId_key"
  ON "pos_kitchen_tickets"("orderId", "merchantId");
CREATE UNIQUE INDEX "pos_kitchen_tickets_orderId_branchId_merchantId_key"
  ON "pos_kitchen_tickets"("orderId", "branchId", "merchantId");
CREATE INDEX "pos_kitchen_tickets_merchantId_branchId_dispatchedAt_id_idx"
  ON "pos_kitchen_tickets"("merchantId", "branchId", "dispatchedAt", "id");

ALTER TABLE "pos_kitchen_stations"
  ADD CONSTRAINT "pos_kitchen_stations_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pos_kitchen_stations_branchId_merchantId_fkey"
  FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_kitchen_tickets"
  ADD CONSTRAINT "pos_kitchen_tickets_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pos_kitchen_tickets_branchId_merchantId_fkey"
  FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pos_kitchen_tickets_stationId_branchId_merchantId_fkey"
  FOREIGN KEY ("stationId", "branchId", "merchantId") REFERENCES "pos_kitchen_stations"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pos_kitchen_tickets_orderId_branchId_merchantId_fkey"
  FOREIGN KEY ("orderId", "branchId", "merchantId") REFERENCES "storefront_orders"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pos_kitchen_tickets_dispatchedByPosEmployeeId_merchantId_fkey"
  FOREIGN KEY ("dispatchedByPosEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve active POS kitchen work created before explicit ticket dispatch existed.
INSERT INTO "pos_kitchen_stations" (
  "id", "merchantId", "branchId", "code", "name", "active", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), branches."merchantId", branches."id", 'default', 'Kitchen', true, now(), now()
FROM "branches" AS branches
ON CONFLICT ("merchantId", "branchId", "code") DO NOTHING;

INSERT INTO "pos_kitchen_tickets" (
  "id", "merchantId", "branchId", "stationId", "orderId", "dispatchMode",
  "dispatchedByPosEmployeeId", "dispatchedAt", "createdAt"
)
SELECT
  gen_random_uuid(), orders."merchantId", orders."branchId", stations."id", orders."id",
  'legacy', orders."createdByPosEmployeeId", orders."createdAt", orders."createdAt"
FROM "storefront_orders" AS orders
JOIN "pos_kitchen_stations" AS stations
  ON stations."merchantId" = orders."merchantId"
 AND stations."branchId" = orders."branchId"
 AND stations."code" = 'default'
WHERE orders."source" = 'pos'
  AND orders."branchId" IS NOT NULL
  AND orders."status" IN ('pending', 'accepted', 'preparing')
ON CONFLICT ("orderId", "merchantId") DO NOTHING;

ALTER TABLE "storefront_order_actions"
  DROP CONSTRAINT "order_action_kind",
  ADD CONSTRAINT "order_action_kind"
    CHECK ("action" IN (
      'accept', 'prepare', 'cancel', 'pos_sale', 'dining_move', 'dining_split',
      'pos_payment', 'pos_kitchen_dispatch'
    ));
