ALTER TABLE "staff_advances" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "cancelledAt" TIMESTAMPTZ(6);
CREATE TABLE "staff_advance_corrections" (
 "id" UUID NOT NULL PRIMARY KEY, "merchantId" UUID NOT NULL,
 "advanceId" UUID NOT NULL, "staffMemberId" UUID NOT NULL,
 "requestId" UUID NOT NULL, "fingerprint" VARCHAR(64) NOT NULL,
 "action" VARCHAR(16) NOT NULL, "reason" VARCHAR(500) NOT NULL,
 "createdBy" VARCHAR(80) NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "before" JSONB NOT NULL, "after" JSONB NOT NULL,
 CONSTRAINT "staff_advance_corrections_advance_fkey" FOREIGN KEY ("advanceId", "staffMemberId", "merchantId")
 REFERENCES "staff_advances"("id", "staffMemberId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "staff_advance_corrections_merchantId_requestId_key" ON "staff_advance_corrections"("merchantId", "requestId");
CREATE INDEX "staff_advance_corrections_merchantId_advanceId_createdAt_idx" ON "staff_advance_corrections"("merchantId", "advanceId", "createdAt");
