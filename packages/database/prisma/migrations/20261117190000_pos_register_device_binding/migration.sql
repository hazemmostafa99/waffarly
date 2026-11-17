ALTER TABLE "pos_registers"
ADD COLUMN "deviceId" UUID;

CREATE UNIQUE INDEX "pos_registers_merchantId_deviceId_key"
ON "pos_registers"("merchantId", "deviceId");

ALTER TABLE "auth_sessions"
ADD COLUMN "deviceId" UUID;
