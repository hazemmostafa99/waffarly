ALTER TABLE "pos_kitchen_tickets"
  ADD COLUMN "cancellationAcknowledgedAt" TIMESTAMPTZ(6),
  ADD COLUMN "cancellationAcknowledgedByPosEmployeeId" UUID;

ALTER TABLE "pos_kitchen_tickets"
  ADD CONSTRAINT "pos_kitchen_cancel_ack_employee_fkey"
  FOREIGN KEY ("cancellationAcknowledgedByPosEmployeeId", "merchantId")
  REFERENCES "pos_employees"("id", "merchantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storefront_order_actions"
  ADD COLUMN "approvedByPosEmployeeId" UUID;

ALTER TABLE "storefront_order_actions"
  ADD CONSTRAINT "storefront_order_actions_approver_fkey"
  FOREIGN KEY ("approvedByPosEmployeeId", "merchantId")
  REFERENCES "pos_employees"("id", "merchantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_order_checks"
  ADD COLUMN "cancelledAt" TIMESTAMPTZ(6);
