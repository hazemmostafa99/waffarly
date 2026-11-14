/** Describes the saved register, shift and cash report details used by this feature. */

import type { Prisma } from '@waffarly/database';

export const registerInclude = {
  branch: { select: { id: true, name: true } },
} satisfies Prisma.PosRegisterInclude;

export const shiftInclude = {
  incomingTransfer: { select: { sourceShiftId: true } },
  register: { select: { name: true } },
  openedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.PosShiftInclude;

export type RegisterRecord = Prisma.PosRegisterGetPayload<{ include: typeof registerInclude }>;
export type ShiftRecord = Prisma.PosShiftGetPayload<{ include: typeof shiftInclude }>;

export const manualCashMovementInclude = {
  operator: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
} satisfies Prisma.PosShiftManualCashMovementInclude;

export const closeReportInclude = {
  operator: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  shift: { select: { branchId: true } },
} satisfies Prisma.PosShiftCloseReportInclude;

export type ManualCashMovementRecord = Prisma.PosShiftManualCashMovementGetPayload<{
  include: typeof manualCashMovementInclude;
}>;
export type CloseReportRecord = Prisma.PosShiftCloseReportGetPayload<{
  include: typeof closeReportInclude;
}>;

export const ownerCloseReportSelect = {
  deliveryCashReceived: true,
  deliveryHandover: true,
  id: true,
  shiftId: true,
  currency: true,
  openingFloat: true,
  cashSales: true,
  cashRefunds: true,
  cashIn: true,
  cashOut: true,
  cashDrop: true,
  expectedCash: true,
  countedCash: true,
  variance: true,
  terminalSales: true,
  terminalRefunds: true,
  reason: true,
  closedAt: true,
  operator: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  shift: {
    select: {
      branchId: true,
      openedAt: true,
      register: { select: { name: true } },
      branch: { select: { name: true } },
      openedBy: { select: { displayName: true } },
    },
  },
} satisfies Prisma.PosShiftCloseReportSelect;

export type OwnerCloseReportRecord = Prisma.PosShiftCloseReportGetPayload<{
  select: typeof ownerCloseReportSelect;
}>;
