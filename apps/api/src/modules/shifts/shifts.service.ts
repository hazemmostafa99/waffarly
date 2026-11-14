/** Routes register and shift requests to the operation that handles them. */
import { listOwnerRegisters, createRegister, updateRegister } from './registers/registers.js';

import { Inject, Injectable } from '@nestjs/common';

import type {
  CursorPage,
  PosDeliveryHandoverRecipient,
  PosEmployeeSession,
  PosRegisterOption,
  PosRegisterSummary,
  PosShiftCloseReport as PosShiftCloseReportContract,
  PosShiftCloseReportRow,
  PosShiftClosePreview,
  PosShiftLiveSummary,
  PosShiftSummary,
  RecordPosShiftCashMovementResponse,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { PrismaService } from '../../infrastructure/database/prisma.service.js';

import {
  type OwnerPosRegisterListQuery,
  type OwnerPosShiftCloseReportsInput,
} from './shifts.schemas.js';

import {
  listDeliveryHandoverRecipients,
  listForEmployee,
  getCurrentShift,
  getShiftBranch,
} from './sessions/shift-queries.js';
import {
  listOwnerCloseReports,
  getLatestCloseReport,
  getCloseReport,
} from './reports/close-report.queries.js';

import { getReconciliation, previewCloseShift } from './reconciliation/shift-preview.js';

import { recordManualCashMovement } from './cash-movements/record-cash-movement.js';
import { closeShift } from './sessions/close-shift.js';
import {
  lockOpenShiftForSale,
  recordCashSale,
  lockOpenShiftForPayment,
  lockDeliveryReceivingShift,
  lockOpenShiftForRefund,
  recordCashRefund,
} from './cash-movements/order-cash-ledger.js';

import { openShift } from './sessions/open-shift.js';

export { buildShiftReconciliation } from './reconciliation/shift-reconciliation.js';

@Injectable()
export class ShiftsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listDeliveryHandoverRecipients(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<CursorPage<PosDeliveryHandoverRecipient>> {
    return listDeliveryHandoverRecipients(this.prisma, employee, input);
  }

  async listOwnerRegisters(
    merchantId: string,
    input: OwnerPosRegisterListQuery,
  ): Promise<CursorPage<PosRegisterSummary>> {
    return listOwnerRegisters(this.prisma, merchantId, input);
  }

  async listOwnerCloseReports(
    merchantId: string,
    input: OwnerPosShiftCloseReportsInput,
  ): Promise<CursorPage<PosShiftCloseReportRow>> {
    return listOwnerCloseReports(this.prisma, merchantId, input);
  }

  async createRegister(
    merchantId: string,
    actor: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    return createRegister(this.prisma, merchantId, actor, input);
  }

  async updateRegister(
    merchantId: string,
    actor: string,
    registerId: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    return updateRegister(this.prisma, merchantId, actor, registerId, input);
  }

  async listForEmployee(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<PosRegisterOption[]> {
    return listForEmployee(this.prisma, employee, input);
  }

  async getCurrentShift(
    employee: PosEmployeeSession,
    registerId: string,
  ): Promise<PosShiftSummary | null> {
    return getCurrentShift(this.prisma, employee, registerId);
  }

  async getReconciliation(
    employee: PosEmployeeSession,
    shiftId: string,
  ): Promise<PosShiftLiveSummary> {
    return getReconciliation(this.prisma, employee, shiftId);
  }

  async previewCloseShift(
    employee: PosEmployeeSession,
    shiftId: string,
    input: unknown,
  ): Promise<PosShiftClosePreview> {
    return previewCloseShift(this.prisma, employee, shiftId, input);
  }

  async getShiftBranch(employee: PosEmployeeSession, shiftId: string): Promise<string> {
    return getShiftBranch(this.prisma, employee, shiftId);
  }

  async getLatestCloseReport(
    employee: PosEmployeeSession,
    registerId: string,
  ): Promise<PosShiftCloseReportContract | null> {
    return getLatestCloseReport(this.prisma, employee, registerId);
  }

  async getCloseReport(
    employee: PosEmployeeSession,
    shiftId: string,
  ): Promise<PosShiftCloseReportContract> {
    return getCloseReport(this.prisma, employee, shiftId);
  }

  async recordManualCashMovement(
    employee: PosEmployeeSession,
    shiftId: string,
    input: unknown,
    approverEmployeeId?: string,
  ): Promise<RecordPosShiftCashMovementResponse> {
    return recordManualCashMovement(this.prisma, employee, shiftId, input, approverEmployeeId);
  }

  async closeShift(
    employee: PosEmployeeSession,
    shiftId: string,
    input: unknown,
    approverEmployeeId?: string,
  ): Promise<PosShiftCloseReportContract> {
    return closeShift(this.prisma, employee, shiftId, input, approverEmployeeId);
  }

  async lockOpenShiftForSale(
    tx: Prisma.TransactionClient,
    employee: PosEmployeeSession,
    registerId: string,
  ): Promise<{ id: string; branchId: string }> {
    return lockOpenShiftForSale(tx, employee, registerId);
  }

  async recordCashSale(
    tx: Prisma.TransactionClient,
    input: {
      merchantId: string;
      shiftId: string;
      paymentId: string;
      operatorEmployeeId: string;
      amount: string;
    },
  ): Promise<void> {
    return recordCashSale(tx, input);
  }

  async lockOpenShiftForPayment(
    tx: Prisma.TransactionClient,
    input: { merchantId: string; shiftId: string; branchId: string },
  ): Promise<void> {
    return lockOpenShiftForPayment(tx, input);
  }

  /** Orders holds the source/follow-up/receiving shift locks in sorted order. */
  async lockDeliveryReceivingShift(
    tx: Prisma.TransactionClient,
    input: {
      merchantId: string;
      branchId: string;
      shiftId: string;
      followupShiftId: string | null;
    },
  ): Promise<void> {
    return lockDeliveryReceivingShift(tx, input);
  }

  async lockOpenShiftForRefund(
    tx: Prisma.TransactionClient,
    input: { merchantId: string; shiftId: string; branchId: string; employee: PosEmployeeSession },
  ): Promise<void> {
    return lockOpenShiftForRefund(tx, input);
  }

  async recordCashRefund(
    tx: Prisma.TransactionClient,
    input: {
      merchantId: string;
      shiftId: string;
      refundTenderId: string;
      operatorEmployeeId: string;
      amount: string;
    },
  ): Promise<void> {
    return recordCashRefund(tx, input);
  }

  async openShift(employee: PosEmployeeSession, input: unknown): Promise<PosShiftSummary> {
    return openShift(this.prisma, employee, input);
  }
}
