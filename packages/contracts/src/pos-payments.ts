import type { PosReceipt, PosReceiptSummary } from './pos-receipts.js';
import type { StorefrontOrderSummary } from './catalog.js';
import type { PosOrderCheckSummary } from './pos-dining.js';

export type PosTenderMethod = 'cash' | 'terminal';

export type PosCheckTender =
  | { method: 'cash'; amount: string; receivedAmount: string }
  | { method: 'terminal'; amount: string; terminalReference?: string | undefined };

export interface RecordPosCheckPaymentRequest {
  requestId: string;
  revision: number;
  tenders: PosCheckTender[];
}

export interface PosPaymentSummary {
  id: string;
  position: number;
  method: PosTenderMethod;
  amount: string;
  receivedAmount: string;
  changeAmount: string;
  terminalReference: string | null;
  operatorEmployeeId: string;
  createdAt: string;
  refundedAmount?: string;
  refundableAmount?: string;
}

export interface RecordPosCheckPaymentResponse {
  orderId: string;
  orderRevision: number;
  check: {
    id: string;
    amount: string;
    paidAmount: string;
    balanceDue: string;
    revision: number;
    status: 'open' | 'settled';
    settledAt: string | null;
    receipt?: PosReceiptSummary | null;
  };
  payments: PosPaymentSummary[];
  receipt?: PosReceipt | null;
}

export interface PosOrderPaymentStateResponse {
  /** Additive checkout context; older deployments may omit it. */
  context?: { order: StorefrontOrderSummary; tableCode: string | null };
  orderId: string;
  revision: number;
  total: string;
  currency: 'EGP';
  status: string;
  checks: Array<{
    splitMethod?: PosOrderCheckSummary['splitMethod'];
    allocations?: PosOrderCheckSummary['allocations'];
    id: string;
    position: number;
    amount: string;
    paidAmount: string;
    balanceDue: string;
    revision: number;
    status: 'open' | 'settled' | 'cancelled';
    settledAt: string | null;
    receipt: PosReceiptSummary | null;
    payments: PosPaymentSummary[];
    refunds?: PosRefundSummary[];
  }>;
}

export interface PosRefundAllocationRequest {
  paymentId: string;
  amount: string;
  /** Required when recording an external terminal refund already completed on the device. */
  terminalReference?: string | undefined;
}

export interface RecordPosCheckRefundRequest {
  requestId: string;
  revision: number;
  branchId: string;
  refundShiftId: string;
  reason: string;
  allocations: PosRefundAllocationRequest[];
  approval?: { username: string; password: string } | undefined;
}

export interface PosRefundTenderSummary {
  originalPaymentId: string;
  method: PosTenderMethod;
  amount: string;
  terminalReference: string | null;
}

export interface PosRefundSummary {
  id: string;
  requestId: string;
  receiptNumber: string;
  checkId: string;
  amount: string;
  currency: 'EGP';
  reason: string;
  issuedAt: string;
  createdByEmployeeId: string;
  approvedByEmployeeId: string | null;
  issuedBy?: string;
  approvedBy?: string | null;
  tenders: PosRefundTenderSummary[];
}

export interface PosRefundReceipt extends PosRefundSummary {
  orderId: string;
  issuedBy: string;
  approvedBy: string | null;
}

export interface RecordPosCheckRefundResponse {
  orderId: string;
  orderRevision: number;
  checkId: string;
  refund: PosRefundReceipt;
}
