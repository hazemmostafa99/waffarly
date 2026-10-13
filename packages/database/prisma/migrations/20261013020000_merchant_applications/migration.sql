CREATE TABLE "merchant_applications" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contactPhone" VARCHAR(32) NOT NULL,
    "ownerName" VARCHAR(160) NOT NULL,
    "ownerMobile" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMPTZ(6),
    "approvedBy" VARCHAR(80),
    "merchantId" UUID,
    CONSTRAINT "merchant_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "merchant_applications_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "merchant_applications_merchantId_key"
    ON "merchant_applications"("merchantId");
CREATE INDEX "merchant_applications_createdAt_idx"
    ON "merchant_applications"("createdAt");
