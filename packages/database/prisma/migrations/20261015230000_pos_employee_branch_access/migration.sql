-- CreateTable
CREATE TABLE "pos_employees" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" VARCHAR(80) NOT NULL,
    "updatedBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pos_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_employee_branches" (
    "employeeId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "createdBy" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_employee_branches_pkey" PRIMARY KEY ("employeeId", "branchId")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_employees_merchantId_username_key" ON "pos_employees"("merchantId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "pos_employees_id_merchantId_key" ON "pos_employees"("id", "merchantId");

-- CreateIndex
CREATE INDEX "pos_employees_merchantId_active_createdAt_id_idx" ON "pos_employees"("merchantId", "active", "createdAt", "id");

-- CreateIndex
CREATE INDEX "pos_employee_branches_merchantId_branchId_employeeId_idx" ON "pos_employee_branches"("merchantId", "branchId", "employeeId");

-- AddForeignKey
ALTER TABLE "pos_employees" ADD CONSTRAINT "pos_employees_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_employee_branches" ADD CONSTRAINT "pos_employee_branches_employeeId_merchantId_fkey" FOREIGN KEY ("employeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_employee_branches" ADD CONSTRAINT "pos_employee_branches_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;
