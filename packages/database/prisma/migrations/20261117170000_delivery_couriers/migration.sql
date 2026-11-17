CREATE TABLE "delivery_couriers" (
  "id" UUID NOT NULL,
  "merchantId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "phone" VARCHAR(32),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdBy" VARCHAR(80) NOT NULL,
  "updatedBy" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "delivery_couriers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_couriers_id_merchantId_key"
  ON "delivery_couriers"("id", "merchantId");
CREATE INDEX "delivery_couriers_merchantId_active_createdAt_id_idx"
  ON "delivery_couriers"("merchantId", "active", "createdAt", "id");

ALTER TABLE "delivery_couriers"
  ADD CONSTRAINT "delivery_couriers_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "merchants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "delivery_courier_branches" (
  "merchantId" UUID NOT NULL,
  "courierId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  CONSTRAINT "delivery_courier_branches_pkey"
    PRIMARY KEY ("merchantId", "courierId", "branchId")
);

CREATE INDEX "delivery_courier_branches_merchantId_branchId_courierId_idx"
  ON "delivery_courier_branches"("merchantId", "branchId", "courierId");

ALTER TABLE "delivery_courier_branches"
  ADD CONSTRAINT "delivery_courier_branches_courierId_merchantId_fkey"
  FOREIGN KEY ("courierId", "merchantId")
  REFERENCES "delivery_couriers"("id", "merchantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_courier_branches"
  ADD CONSTRAINT "delivery_courier_branches_branchId_merchantId_fkey"
  FOREIGN KEY ("branchId", "merchantId")
  REFERENCES "branches"("id", "merchantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
