/** Prepares saved shifts, cash movements and close reports for staff to read. */
import { ConflictException, ForbiddenException } from '@nestjs/common';

import type {
  PosDeliveryHandoverSnapshot,
  PosEmployeeSession,
  PosRegisterSummary,
  PosShiftCloseReport as PosShiftCloseReportContract,
  PosShiftCloseReportRow,
  PosShiftLiveSummary,
  PosShiftManualCashMovementSummary,
  PosShiftReconciliationSummary,
  PosShiftSummary,
} from '@waffarly/contracts';

import {
  type RegisterRecord,
  type ShiftRecord,
  type ManualCashMovementRecord,
  type CloseReportRecord,
  type OwnerCloseReportRecord,
} from './shift-records.js';
export function toManualCashMovementSummary(
  movement: ManualCashMovementRecord,
): PosShiftManualCashMovementSummary {
  return {
    id: movement.id,
    requestId: movement.requestId,
    kind: movement.kind as 'cash_in' | 'cash_out' | 'cash_drop',
    amount: movement.amount.toFixed(2),
    dropReference: movement.dropReference,
    reason: movement.reason,
    createdAt: movement.createdAt.toISOString(),
    operatorName: movement.operator.displayName,
    approvedByName: movement.approvedBy?.displayName ?? null,
  };
}

export function toLiveShiftSummary(
  reconciliation: PosShiftReconciliationSummary,
): PosShiftLiveSummary {
  return {
    shiftId: reconciliation.shiftId,
    branchId: reconciliation.branchId,
    registerId: reconciliation.registerId,
    registerName: reconciliation.registerName,
    currency: reconciliation.currency,
    unsettledCheckCount: reconciliation.unsettledCheckCount,
    unsettledBalance: reconciliation.unsettledBalance,
    manualMovements: reconciliation.manualMovements,
    pendingDeliveryCount: reconciliation.pendingDeliveryCount ?? 0,
    pendingDeliveryBalance: reconciliation.pendingDeliveryBalance ?? '0.00',
  };
}

export function toCloseReport(report: CloseReportRecord): PosShiftCloseReportContract {
  const snapshot = report.snapshot as unknown as PosShiftReconciliationSummary;
  return {
    ...snapshot,
    id: report.id,
    requestId: report.requestId,
    shiftId: report.shiftId,
    currency: report.currency as 'EGP',
    openingFloat: report.openingFloat.toFixed(2),
    cashSales: report.cashSales.toFixed(2),
    deliveryCashReceived: report.deliveryCashReceived.toFixed(2),
    deliveryHandover: report.deliveryHandover as unknown as PosDeliveryHandoverSnapshot | null,
    cashRefunds: report.cashRefunds.toFixed(2),
    cashIn: report.cashIn.toFixed(2),
    cashOut: report.cashOut.toFixed(2),
    cashDrop: report.cashDrop.toFixed(2),
    expectedCash: report.expectedCash.toFixed(2),
    countedCash: report.countedCash.toFixed(2),
    variance: report.variance.toFixed(2),
    terminalSales: report.terminalSales.toFixed(2),
    terminalRefunds: report.terminalRefunds.toFixed(2),
    closedAt: report.closedAt.toISOString(),
    operatorName: report.operator.displayName,
    approvedByName: report.approvedBy?.displayName ?? null,
    reason: report.reason,
  };
}

export function toOwnerCloseReportRow(report: OwnerCloseReportRecord): PosShiftCloseReportRow {
  return {
    id: report.id,
    shiftId: report.shiftId,
    branchId: report.shift.branchId,
    branchName: report.shift.branch.name,
    registerName: report.shift.register.name,
    openedAt: report.shift.openedAt.toISOString(),
    closedAt: report.closedAt.toISOString(),
    openedByName: report.shift.openedBy.displayName,
    operatorName: report.operator.displayName,
    approvedByName: report.approvedBy?.displayName ?? null,
    currency: report.currency as 'EGP',
    openingFloat: report.openingFloat.toFixed(2),
    cashSales: report.cashSales.toFixed(2),
    deliveryCashReceived: report.deliveryCashReceived.toFixed(2),
    deliveryHandover: report.deliveryHandover as unknown as PosDeliveryHandoverSnapshot | null,
    cashRefunds: report.cashRefunds.toFixed(2),
    cashIn: report.cashIn.toFixed(2),
    cashOut: report.cashOut.toFixed(2),
    cashDrop: report.cashDrop.toFixed(2),
    expectedCash: report.expectedCash.toFixed(2),
    countedCash: report.countedCash.toFixed(2),
    variance: report.variance.toFixed(2),
    terminalSales: report.terminalSales.toFixed(2),
    terminalRefunds: report.terminalRefunds.toFixed(2),
    reason: report.reason,
  };
}

export function toMatchingRetry(
  shift: ShiftRecord,
  employee: PosEmployeeSession,
  registerId: string,
  openingFloat: string,
  sourceShiftId?: string,
): PosShiftSummary {
  if (!employee.branches.some((branch) => branch.id === shift.branchId)) {
    throw new ForbiddenException('This employee is not assigned to the selected branch.');
  }
  if (
    shift.registerId !== registerId ||
    shift.openedByEmployeeId !== employee.id ||
    shift.openingFloat.toFixed(2) !== openingFloat ||
    (shift.incomingTransfer?.sourceShiftId ?? undefined) !== sourceShiftId
  ) {
    throw new ConflictException('This request ID was already used for a different shift opening.');
  }
  if (shift.status !== 'open') {
    throw new ConflictException('This shift opening request has already been resolved.');
  }
  return toShiftSummary(shift);
}

export function toRegisterSummary(register: RegisterRecord): PosRegisterSummary {
  return {
    id: register.id,
    branchId: register.branchId,
    branchName: register.branch.name,
    name: register.name,
    active: register.active,
    revision: register.revision,
  };
}

export function toShiftSummary(shift: ShiftRecord): PosShiftSummary {
  if (shift.status !== 'open') throw new ConflictException('This shift is no longer open.');
  return {
    id: shift.id,
    branchId: shift.branchId,
    registerId: shift.registerId,
    registerName: shift.register.name,
    openedByEmployeeId: shift.openedBy.id,
    openedByName: shift.openedBy.displayName,
    openRequestId: shift.openRequestId,
    openingFloat: shift.openingFloat.toFixed(2),
    currency: 'EGP',
    openedAt: shift.openedAt.toISOString(),
    status: 'open',
  };
}
