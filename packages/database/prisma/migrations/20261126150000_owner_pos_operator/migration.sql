ALTER TABLE "pos_employees" ADD COLUMN "ownerAccountId" UUID;
ALTER TABLE "pos_employees" ADD COLUMN "ownerOperatorKey" VARCHAR(80);

ALTER TABLE "pos_employees"
  ADD CONSTRAINT "pos_employees_ownerAccountId_fkey"
  FOREIGN KEY ("ownerAccountId") REFERENCES "owner_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "pos_employees_ownerOperatorKey_key"
  ON "pos_employees"("ownerOperatorKey");
