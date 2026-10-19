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
    status: 'open' | 'settled';
    settledAt: string | null;
    receipt: PosReceiptSummary | null;
    payments: PosPaymentSummary[];
  }>;
}
