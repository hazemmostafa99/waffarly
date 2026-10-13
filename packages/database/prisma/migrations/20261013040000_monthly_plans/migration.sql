CREATE TABLE "monthly_plans" (
    "id" UUID NOT NULL,
    "creationRequest" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "billingInterval" VARCHAR(16) NOT NULL DEFAULT 'monthly',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" VARCHAR(80) NOT NULL,
    "updatedBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "monthly_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "monthly_plans_price_check" CHECK ("monthlyPrice" >= 0),
    CONSTRAINT "monthly_plans_currency_check" CHECK ("currency" IN ('EGP', 'USD', 'EUR')),
    CONSTRAINT "monthly_plans_interval_check" CHECK ("billingInterval" = 'monthly'),
    CONSTRAINT "monthly_plans_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "monthly_plans_name_check" CHECK (length(trim("name")) > 0)
);

CREATE UNIQUE INDEX "monthly_plans_creationRequest_key" ON "monthly_plans"("creationRequest");
