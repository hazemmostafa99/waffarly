ALTER TABLE "merchants"
  ADD COLUMN "storefrontHandle" VARCHAR(63),
  ADD COLUMN "storefrontHandleAssignedAt" TIMESTAMPTZ(6),
  ADD COLUMN "storefrontHandleAssignedBy" VARCHAR(80);

CREATE UNIQUE INDEX "merchants_storefrontHandle_key" ON "merchants"("storefrontHandle");

ALTER TABLE "merchants" ADD CONSTRAINT "merchants_storefrontHandle_valid" CHECK (
  "storefrontHandle" IS NULL OR (
    char_length("storefrontHandle") BETWEEN 3 AND 63
    AND "storefrontHandle" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND "storefrontHandle" NOT IN (
      'admin', 'pos', 'api', 'www', 'dashboard', 'merchant', 'marketplace', 'business',
      'auth', 'login', 'support', 'mail', 'assets', 'static', 'cdn'
    )
  )
);
