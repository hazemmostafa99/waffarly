ALTER TABLE "merchant_applications"
    ADD COLUMN "rejectedAt" TIMESTAMPTZ(6),
    ADD COLUMN "rejectedBy" VARCHAR(80),
    ADD COLUMN "rejectionReason" TEXT;
