export interface PosDeliverySummary {
  orderId: string;
  branchId: string;
  sourceShiftId: string;
  followupShiftId: string | null;
  revision: number;
  orderRevision: number;
  orderStatus: string;
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
  | { action: 'dispatch'; courierName: string }
  | { action: 'delivered' }
  | { action: 'failed'; reason: string }
  | { action: 'claim'; receivingShiftId: string }
  | { action: 'remit'; receivingShiftId: string; paymentId: string; amount: string }
);

export interface PosDeliveryHandoverSnapshot {
  recipientEmployeeId: string;
  recipientName: string;
  approvedByName: string;
  deliveries: Array<{
    orderId: string;
    courierName: string;
    status: string;
    customerDue: string;
    courierCashHeld: string;
  }>;
}
