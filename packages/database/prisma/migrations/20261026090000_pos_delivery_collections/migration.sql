-- DropForeignKey
ALTER TABLE "pos_order_payments" DROP CONSTRAINT "pos_order_payments_orderId_shiftId_merchantId_fkey";

-- AlterTable
ALTER TABLE "pos_order_payments" ADD COLUMN     "cashCustody" VARCHAR(12) NOT NULL DEFAULT 'drawer';

-- AlterTable
ALTER TABLE "pos_shift_close_reports" ADD COLUMN     "deliveryCashReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryHandover" JSONB;

-- CreateTable
CREATE TABLE "pos_deliveries" (
    "orderId" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "followupShiftId" UUID,
    "custodianEmployeeId" UUID NOT NULL,
    "courierName" VARCHAR(160) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'out_for_delivery',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "dispatchedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(6),
    "failureReason" VARCHAR(500),

    CONSTRAINT "pos_deliveries_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "pos_delivery_remittances" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "operatorEmployeeId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_delivery_remittances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_deliveries_merchantId_branchId_dispatchedAt_orderId_idx" ON "pos_deliveries"("merchantId", "branchId", "dispatchedAt", "orderId");

-- CreateIndex
CREATE INDEX "pos_deliveries_merchantId_followupShiftId_idx" ON "pos_deliveries"("merchantId", "followupShiftId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_deliveries_orderId_merchantId_key" ON "pos_deliveries"("orderId", "merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_deliveries_orderId_branchId_merchantId_key" ON "pos_deliveries"("orderId", "branchId", "merchantId");

-- CreateIndex
CREATE INDEX "pos_delivery_remittances_merchantId_paymentId_idx" ON "pos_delivery_remittances"("merchantId", "paymentId");

-- CreateIndex
CREATE INDEX "pos_delivery_remittances_merchantId_shiftId_createdAt_idx" ON "pos_delivery_remittances"("merchantId", "shiftId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pos_delivery_remittances_merchantId_requestId_key" ON "pos_delivery_remittances"("merchantId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_shifts_id_branchId_merchantId_key" ON "pos_shifts"("id", "branchId", "merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_order_payments_id_orderId_merchantId_key" ON "pos_order_payments"("id", "orderId", "merchantId");

-- AddForeignKey
ALTER TABLE "pos_order_payments" ADD CONSTRAINT "pos_order_payments_orderId_merchantId_fkey" FOREIGN KEY ("orderId", "merchantId") REFERENCES "storefront_orders"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_deliveries" ADD CONSTRAINT "pos_deliveries_orderId_branchId_merchantId_fkey" FOREIGN KEY ("orderId", "branchId", "merchantId") REFERENCES "storefront_orders"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_deliveries" ADD CONSTRAINT "pos_deliveries_branchId_merchantId_fkey" FOREIGN KEY ("branchId", "merchantId") REFERENCES "branches"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_deliveries" ADD CONSTRAINT "pos_deliveries_followupShiftId_branchId_merchantId_fkey" FOREIGN KEY ("followupShiftId", "branchId", "merchantId") REFERENCES "pos_shifts"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_deliveries" ADD CONSTRAINT "pos_deliveries_custodianEmployeeId_merchantId_fkey" FOREIGN KEY ("custodianEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_delivery_remittances" ADD CONSTRAINT "pos_delivery_remittances_orderId_branchId_merchantId_fkey" FOREIGN KEY ("orderId", "branchId", "merchantId") REFERENCES "pos_deliveries"("orderId", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_delivery_remittances" ADD CONSTRAINT "pos_delivery_remittances_paymentId_orderId_merchantId_fkey" FOREIGN KEY ("paymentId", "orderId", "merchantId") REFERENCES "pos_order_payments"("id", "orderId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_delivery_remittances" ADD CONSTRAINT "pos_delivery_remittances_shiftId_branchId_merchantId_fkey" FOREIGN KEY ("shiftId", "branchId", "merchantId") REFERENCES "pos_shifts"("id", "branchId", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_delivery_remittances" ADD CONSTRAINT "pos_delivery_remittances_operatorEmployeeId_merchantId_fkey" FOREIGN KEY ("operatorEmployeeId", "merchantId") REFERENCES "pos_employees"("id", "merchantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_order_payments" ADD CONSTRAINT "pos_payment_cash_custody_check"
  CHECK ("cashCustody" IN ('drawer', 'courier') AND ("cashCustody" <> 'courier' OR "method" = 'cash'));
ALTER TABLE "pos_deliveries" ADD CONSTRAINT "pos_delivery_status_check"
  CHECK ("status" IN ('out_for_delivery', 'delivered', 'failed') AND "revision" > 0
    AND ("status" <> 'failed' OR ("failureReason" IS NOT NULL AND LENGTH(TRIM("failureReason")) > 0))
    AND (("status" = 'delivered') = ("deliveredAt" IS NOT NULL)));
ALTER TABLE "pos_delivery_remittances" ADD CONSTRAINT "pos_delivery_remittance_amount_check" CHECK ("amount" > 0);
ALTER TABLE "pos_shift_close_reports" ADD CONSTRAINT "pos_delivery_drawer_total_check" CHECK ("deliveryCashReceived" >= 0);

-- Preserve branch consistency when a later delivery payment uses another shift.
CREATE FUNCTION "assert_pos_payment_branch"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "storefront_orders" o JOIN "pos_shifts" s
      ON s."branchId" = o."branchId" AND s."merchantId" = o."merchantId"
    WHERE o."id" = NEW."orderId" AND o."merchantId" = NEW."merchantId" AND s."id" = NEW."shiftId"
  ) THEN RAISE EXCEPTION 'Payment shift must belong to the order branch' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "pos_payment_same_branch" BEFORE INSERT OR UPDATE OF "orderId", "merchantId", "shiftId"
  ON "pos_order_payments" FOR EACH ROW EXECUTE FUNCTION "assert_pos_payment_branch"();

ALTER TABLE "storefront_order_actions" DROP CONSTRAINT "order_action_kind",
  ADD CONSTRAINT "order_action_kind" CHECK ("action" IN (
    'accept', 'prepare', 'cancel', 'pos_sale', 'dining_move', 'dining_split',
    'pos_payment', 'pos_kitchen_dispatch', 'ready', 'handover', 'ready_item',
    'pos_kitchen_amendment', 'pos_cancel', 'pos_cancel_ack', 'pos_refund', 'pos_delivery'
  ));
