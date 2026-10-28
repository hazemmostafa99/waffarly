ALTER TABLE "monthly_plans" ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "plan_terms" (
  "planId" UUID NOT NULL REFERENCES "monthly_plans"("id") ON DELETE CASCADE,
  "months" INTEGER NOT NULL CHECK ("months" IN (3,6,12,24)),
  "price" DECIMAL(10,2) NOT NULL CHECK ("price" >= 0),
  PRIMARY KEY ("planId", "months")
);
CREATE TABLE "subscriptions" (
  "merchantId" UUID PRIMARY KEY REFERENCES "merchants"("id") ON DELETE RESTRICT,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','active','suspended','cancelled','legacy')),
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  "cancelAtEnd" BOOLEAN NOT NULL DEFAULT false,
  "assignedPlanId" UUID REFERENCES "monthly_plans"("id") ON DELETE RESTRICT,
  "assignedMonths" INTEGER CHECK ("assignedMonths" IN (1,3,6,12,24)),
  CHECK (("assignedPlanId" IS NULL) = ("assignedMonths" IS NULL))
);
CREATE TABLE "subscription_periods" (
  "id" UUID PRIMARY KEY,
  "merchantId" UUID NOT NULL REFERENCES "subscriptions"("merchantId") ON DELETE RESTRICT,
  "planId" UUID NOT NULL REFERENCES "monthly_plans"("id") ON DELETE RESTRICT,
  "planName" VARCHAR(160) NOT NULL,
  "months" INTEGER NOT NULL CHECK ("months" IN (1,3,6,12,24)),
  "price" DECIMAL(10,2) NOT NULL CHECK ("price" >= 0),
  "collected" DECIMAL(10,2) NOT NULL CHECK ("collected" >= 0),
  "credit" DECIMAL(10,2) NOT NULL CHECK ("credit" >= 0),
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6) NOT NULL,
  "coverageEndsAt" TIMESTAMPTZ(6) NOT NULL,
  CHECK ("endsAt" > "startsAt" AND "coverageEndsAt" >= "startsAt" AND "coverageEndsAt" <= "endsAt"),
  CHECK ("price" = "collected" + "credit")
);
CREATE INDEX "subscription_periods_merchantId_startsAt_coverageEndsAt_idx" ON "subscription_periods"("merchantId","startsAt","coverageEndsAt");
CREATE TABLE "subscription_events" (
  "id" UUID PRIMARY KEY,
  "merchantId" UUID NOT NULL REFERENCES "subscriptions"("merchantId") ON DELETE RESTRICT,
  "requestId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "action" VARCHAR(24) NOT NULL,
  "administrator" VARCHAR(80) NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "collected" DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK ("collected" >= 0),
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("merchantId","requestId")
);
CREATE INDEX "subscription_events_merchantId_createdAt_id_idx" ON "subscription_events"("merchantId","createdAt","id");
INSERT INTO "subscriptions" ("merchantId","status")
SELECT "id", CASE WHEN "firstMonthActivatedAt" IS NULL THEN 'pending' ELSE 'legacy' END FROM "merchants";
-- New tenants always have a subscription; historical coverage is never invented.
CREATE FUNCTION create_merchant_subscription() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "subscriptions" ("merchantId","status") VALUES (NEW."id", CASE WHEN NEW."firstMonthActivatedAt" IS NULL THEN 'pending' ELSE 'legacy' END);
  RETURN NEW;
END;
$$;
CREATE TRIGGER merchant_subscription_after_insert AFTER INSERT ON "merchants"
FOR EACH ROW EXECUTE FUNCTION create_merchant_subscription();
