export interface PosRegisterSummary {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  active: boolean;
  revision: number;
}

export interface PosRegisterOption {
  id: string;
  branchId: string;
  name: string;
}

export interface PosDeliveryHandoverRecipient {
  id: string;
  username: string;
  displayName: string;
}

export interface PosShiftSummary {
  id: string;
  branchId: string;
  registerId: string;
  registerName: string;
  openedByEmployeeId: string;
  openedByName: string;
  openRequestId: string;
  openingFloat: string;
  currency: 'EGP';
  openedAt: string;
  status: 'open';
}

export interface CreatePosRegisterRequest {
  branchId: string;
  name: string;
}

export interface UpdatePosRegisterRequest {
  revision: number;
  name: string;
  active: boolean;
}

export interface OpenPosShiftRequest {
  sourceShiftId?: string | undefined;
  registerId: string;
  requestId: string;
  openingFloat: string;
}

export interface PosShiftManualCashMovementSummary {
  id: string;
  requestId: string;
  kind: 'cash_in' | 'cash_out' | 'cash_drop';
  amount: string;
  dropReference: string | null;
  reason: string;
  createdAt: string;
  operatorName: string;
  approvedByName: string | null;
}

export interface PosShiftReconciliationSummary {
  shiftId: string;
  branchId: string;
  registerId: string;
  registerName: string;
  currency: 'EGP';
  openingFloat: string;
  cashSales: string;
  deliveryCashReceived?: string;
  pendingDeliveryCount?: number;
  pendingDeliveryBalance?: string;
  cashRefunds: string;
  cashIn: string;
  cashOut: string;
  cashDrop: string;
  expectedCash: string;
  countedCash: string | null;
  variance: string | null;
  terminalSales: string;
  terminalRefunds: string;
  unsettledCheckCount: number;
  unsettledBalance: string;
  manualMovements: PosShiftManualCashMovementSummary[];
}

/** Safe open-shift data for the cashier UI; drawer totals are intentionally withheld until close. */
export interface PosShiftLiveSummary {
  shiftId: string;
  branchId: string;
  registerId: string;
  registerName: string;
  currency: 'EGP';
  unsettledCheckCount: number;
  unsettledBalance: string;
  manualMovements: PosShiftManualCashMovementSummary[];
  pendingDeliveryCount?: number;
  pendingDeliveryBalance?: string;
}

export interface PosShiftClosePreviewRequest {
  countedCash: string;
  reason?: string | undefined;
  deliveryHandover?: { recipientUsername: string } | undefined;
}

/** Reveals only the actions required after the operator submits a blind physical count. */
export interface PosShiftClosePreview {
  unsettledCheckCount: number;
  requiresReason: boolean;
  requiresSupervisorApproval: boolean;
  pendingDeliveryCount?: number;
  requiresDeliveryHandover?: boolean;
}

export interface RecordPosShiftCashMovementRequest {
  safeId?: string | undefined;
  requestId: string;
  kind: 'cash_in' | 'cash_out' | 'cash_drop';
  amount: string;
  reason: string;
  dropReference?: string | undefined;
  approval?: { username: string; password: string } | undefined;
}

export interface RecordPosShiftCashMovementResponse {
  shiftId: string;
  reconciliation: PosShiftLiveSummary;
  movement: PosShiftManualCashMovementSummary;
}

export interface ClosePosShiftRequest {
  requestId: string;
  countedCash: string;
  reason?: string | undefined;
  approval?: { username: string; password: string } | undefined;
  deliveryHandover?: { recipientUsername: string } | undefined;
}

export interface PosShiftCloseReport extends Omit<
  PosShiftReconciliationSummary,
  'countedCash' | 'variance'
> {
  id: string;
  requestId: string;
  closedAt: string;
  countedCash: string;
  variance: string;
  operatorName: string;
  approvedByName: string | null;
  reason: string | null;
  deliveryHandover?: PosDeliveryHandoverSnapshot | null;
}

export interface PosShiftCloseReportRow {
  id: string;
  shiftId: string;
  branchId: string;
  branchName: string;
  registerName: string;
  openedAt: string;
  closedAt: string;
  openedByName: string;
  operatorName: string;
  approvedByName: string | null;
  currency: 'EGP';
  openingFloat: string;
  cashSales: string;
  cashRefunds: string;
  cashIn: string;
  cashOut: string;
  cashDrop: string;
  expectedCash: string;
  countedCash: string;
  variance: string;
  terminalSales: string;
  terminalRefunds: string;
  reason: string | null;
  deliveryCashReceived?: string;
  deliveryHandover?: PosDeliveryHandoverSnapshot | null;
}

export interface OwnerPosShiftCloseReportsQuery {
  from: string;
  to: string;
  branchId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}
import type { PosDeliveryHandoverSnapshot } from './pos-delivery.js';
