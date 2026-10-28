export interface CashSafeSummary {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  balance: string;
  pendingAmount: string;
}

export interface CashTransferSummary {
  id: string;
  sourceShiftId: string;
  registerName: string;
  branchId: string;
  destinationName: string;
  kind: 'safe' | 'carryover';
  amount: string;
  receivedAmount: string | null;
  difference: string | null;
  status: 'pending' | 'received' | 'discrepancy' | 'resolved';
  reference: string;
  reason: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  receivedBy: string | null;
  receivedByName?: string | null;
  receivedAt: string | null;
  receiptNote: string | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
}

export interface CashDrawerSummary {
  id: string;
  branchId: string;
  branchName: string;
  registerId: string;
  registerName: string;
  cashierName: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  expectedCash: string;
  countedCash: string | null;
  variance: string | null;
  remainingCash: string;
  pendingAmount: string;
  receivedInSafe: string;
  carriedForward: string;
  legacyDropAmount: string;
}

export interface CashSafeMovementSummary {
  id: string;
  kind: string;
  amount: string;
  balanceAfter: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  transferId: string | null;
}
