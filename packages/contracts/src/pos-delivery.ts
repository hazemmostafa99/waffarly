export interface PosDeliverySummary {
  orderId: string;
  orderReference?: string | null;
  branchOrderNumber?: number | null;
  branchId: string;
  sourceShiftId: string;
  followupShiftId: string | null;
  revision: number;
  orderRevision: number;
  orderStatus: string;
  courierId: string | null;
  courierName: string;
  status: 'out_for_delivery' | 'delivered' | 'failed';
  dispatchedAt: string;
  deliveredAt: string | null;
  failureReason: string | null;
  custodianName: string;
  custodianEmployeeId: string;
  customerDue: string;
  courierCashHeld: string;
  checks: Array<{ id: string; position: number; balanceDue: string }>;
  courierPayments: Array<{ id: string; amount: string; remaining: string }>;
  remittances?: Array<{
    amount: string;
    shiftId: string;
    operatorName: string;
    receivedAt: string;
  }>;
}

export type PosDeliveryCommand = {
  requestId: string;
  revision: number;
} & (
  // registerId links a ready website delivery to the cashier's open shift on first dispatch.
  | { action: 'dispatch'; courierId: string; registerId?: string }
  // Allows exact recovery of a dispatch saved by an older POS client.
  | { action: 'dispatch'; courierName: string }
  | { action: 'delivered' }
  | { action: 'failed'; reason: string }
  | { action: 'claim'; receivingShiftId: string }
  | { action: 'remit'; receivingShiftId: string; paymentId: string; amount: string }
);

export interface PosDeliveryHandoverSnapshot {
  recipientEmployeeId?: string | null;
  recipientName?: string | null;
  approvedByName?: string | null;
  deliveries: Array<{
    orderId: string;
    courierName: string;
    status: string;
    customerDue: string;
    courierCashHeld: string;
  }>;
}
