ALTER TABLE "pos_employees"
ADD COLUMN "branchId" UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT employee."id"
    FROM "pos_employees" AS employee
    LEFT JOIN "pos_employee_branches" AS assignment
      ON assignment."employeeId" = employee."id"
     AND assignment."merchantId" = employee."merchantId"
    GROUP BY employee."id"
    HAVING COUNT(assignment."branchId") <> 1
  ) THEN
    RAISE EXCEPTION
      'Cannot migrate POS employee branches: every employee must have exactly one branch assignment.';
  END IF;
END $$;

UPDATE "pos_employees" AS employee
SET "branchId" = assignment."branchId"
FROM "pos_employee_branches" AS assignment
WHERE assignment."employeeId" = employee."id"
  AND assignment."merchantId" = employee."merchantId";

ALTER TABLE "pos_employees"
ALTER COLUMN "branchId" SET NOT NULL;

CREATE INDEX "pos_employees_merchantId_branchId_idx"
ON "pos_employees"("merchantId", "branchId");

ALTER TABLE "pos_employees"
ADD CONSTRAINT "pos_employees_branchId_merchantId_fkey"
FOREIGN KEY ("branchId", "merchantId")
REFERENCES "branches"("id", "merchantId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

DROP TABLE "pos_employee_branches";
