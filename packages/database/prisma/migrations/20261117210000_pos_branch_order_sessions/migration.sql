CREATE TABLE "pos_branch_order_sessions" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMPTZ(6),
  CONSTRAINT "pos_branch_order_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_branch_order_sessions_lastNumber_check" CHECK ("lastNumber" >= 0),
  CONSTRAINT "pos_branch_order_sessions_id_merchantId_key" UNIQUE ("id", "merchantId"),
  CONSTRAINT "pos_branch_order_sessions_id_branchId_merchantId_key"
    UNIQUE ("id", "branchId", "merchantId"),
  CONSTRAINT "pos_branch_order_sessions_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "merchants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pos_branch_order_sessions_branchId_merchantId_fkey"
    FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "pos_branch_order_sessions_merchantId_branchId_openedAt_idx"
  ON "pos_branch_order_sessions"("merchantId", "branchId", "openedAt");

ALTER TABLE "pos_shifts"
  ADD COLUMN "branchOrderSessionId" UUID;

ALTER TABLE "storefront_orders"
  ADD COLUMN "branchOrderSessionId" UUID,
  ADD COLUMN "branchOrderNumber" INTEGER;

CREATE TEMPORARY TABLE "pos_branch_order_session_backfill" AS
WITH shift_windows AS (
  SELECT
    s."id" AS "shiftId",
    s."merchantId",
    s."branchId",
    s."openedAt",
    s."closedAt",
    MAX(COALESCE(s."closedAt", 'infinity'::timestamptz)) OVER (
      PARTITION BY s."merchantId", s."branchId"
      ORDER BY s."openedAt", s."id"
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS "previousSessionEnd"
  FROM "pos_shifts" s
), session_starts AS (
  SELECT
    *,
    CASE
      WHEN "previousSessionEnd" IS NULL OR "openedAt" >= "previousSessionEnd" THEN 1
      ELSE 0
    END AS "startsSession"
  FROM shift_windows
), numbered_shifts AS (
  SELECT
    *,
    SUM("startsSession") OVER (
      PARTITION BY "merchantId", "branchId"
      ORDER BY "openedAt", "shiftId"
      ROWS UNBOUNDED PRECEDING
    ) AS "sessionSequence"
  FROM session_starts
), session_groups AS (
  SELECT
    "merchantId",
    "branchId",
    "sessionSequence",
    gen_random_uuid() AS "sessionId",
    MIN("openedAt") AS "sessionOpenedAt",
    CASE WHEN BOOL_OR("closedAt" IS NULL) THEN NULL ELSE MAX("closedAt") END AS "sessionClosedAt"
  FROM numbered_shifts
  GROUP BY "merchantId", "branchId", "sessionSequence"
)
SELECT
  shifts."shiftId",
  groups."merchantId",
  groups."branchId",
  groups."sessionId",
  groups."sessionOpenedAt",
  groups."sessionClosedAt"
FROM numbered_shifts shifts
INNER JOIN session_groups groups
  ON groups."merchantId" = shifts."merchantId"
  AND groups."branchId" = shifts."branchId"
  AND groups."sessionSequence" = shifts."sessionSequence";

INSERT INTO "pos_branch_order_sessions" (
  "id", "merchantId", "branchId", "openedAt", "closedAt", "lastNumber"
)
SELECT DISTINCT
  "sessionId", "merchantId", "branchId", "sessionOpenedAt", "sessionClosedAt", 0
FROM "pos_branch_order_session_backfill";

UPDATE "pos_shifts" shifts
SET "branchOrderSessionId" = mapping."sessionId"
FROM "pos_branch_order_session_backfill" mapping
WHERE shifts."id" = mapping."shiftId";

WITH numbered_orders AS (
  SELECT
    orders."id",
    mapping."sessionId",
    ROW_NUMBER() OVER (
      PARTITION BY mapping."sessionId"
      ORDER BY orders."createdAt", orders."id"
    )::INTEGER AS "branchOrderNumber"
  FROM "storefront_orders" orders
  INNER JOIN "pos_branch_order_session_backfill" mapping
    ON mapping."shiftId" = orders."posShiftId"
  WHERE orders."source" = 'pos'
)
UPDATE "storefront_orders" orders
SET
  "branchOrderSessionId" = numbered."sessionId",
  "branchOrderNumber" = numbered."branchOrderNumber"
FROM numbered_orders numbered
WHERE orders."id" = numbered."id";

UPDATE "pos_branch_order_sessions" sessions
SET "lastNumber" = numbers."lastNumber"
FROM (
  SELECT "branchOrderSessionId", MAX("branchOrderNumber") AS "lastNumber"
  FROM "storefront_orders"
  WHERE "branchOrderNumber" IS NOT NULL
  GROUP BY "branchOrderSessionId"
) numbers
WHERE sessions."id" = numbers."branchOrderSessionId";

ALTER TABLE "pos_shifts"
  ALTER COLUMN "branchOrderSessionId" SET NOT NULL,
  ADD CONSTRAINT "pos_shifts_branchOrderSessionId_branchId_merchantId_fkey"
    FOREIGN KEY ("branchOrderSessionId", "branchId", "merchantId")
    REFERENCES "pos_branch_order_sessions"("id", "branchId", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storefront_orders"
  ADD CONSTRAINT "storefront_orders_branchOrderNumber_check"
    CHECK ("branchOrderNumber" IS NULL OR "branchOrderNumber" > 0),
  ADD CONSTRAINT "storefront_orders_branchOrderSessionId_branchId_merchantId_fkey"
    FOREIGN KEY ("branchOrderSessionId", "branchId", "merchantId")
    REFERENCES "pos_branch_order_sessions"("id", "branchId", "merchantId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "storefront_orders_branchOrderSessionId_branchOrderNumber_key"
  ON "storefront_orders"("branchOrderSessionId", "branchOrderNumber");

CREATE INDEX "pos_shifts_branchOrderSessionId_status_idx"
  ON "pos_shifts"("branchOrderSessionId", "status");

CREATE INDEX "storefront_orders_merchantId_branchId_branchOrderSessionId_branchOrderNumber_idx"
  ON "storefront_orders"("merchantId", "branchId", "branchOrderSessionId", "branchOrderNumber");

DROP TABLE "pos_branch_order_session_backfill";
