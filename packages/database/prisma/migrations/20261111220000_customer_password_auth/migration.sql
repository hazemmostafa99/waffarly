ALTER TABLE "customer_accounts"
  ALTER COLUMN "phoneVerifiedAt" DROP NOT NULL,
  ADD COLUMN "email" VARCHAR(254),
  ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(6),
  ADD COLUMN "passwordHash" VARCHAR(255),
  ADD CONSTRAINT "customer_accounts_email_normalized" CHECK ("email" IS NULL OR "email" = lower(trim("email")));
CREATE UNIQUE INDEX "customer_accounts_email_key" ON "customer_accounts"("email");

CREATE TABLE "customer_auth_limits" (
  "key" VARCHAR(64) NOT NULL PRIMARY KEY,
  "attempts" INTEGER NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "customer_auth_limits_expiresAt_idx" ON "customer_auth_limits"("expiresAt");
