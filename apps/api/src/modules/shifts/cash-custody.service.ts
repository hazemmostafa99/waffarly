/** Routes safe, drawer and cash handoff requests to their responsible operation. */
import { Inject, Injectable } from '@nestjs/common';

import type {
  CashDrawerSummary,
  CashSafeMovementSummary,
  CashSafeSummary,
  CashTransferSummary,
  CursorPage,
  PosEmployeeSession,
} from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

import { requireEmployeeCashBranch } from './custody/custody-access.js';
import { listSafes, createSafe, safeMovement, safeLedger } from './custody/safes.js';

import {
  listTransfers,
  transferClosedCash,
  receive,
  receiveForEmployee,
  resolve,
} from './custody/transfers.js';

import { drawerLedger, carryoverOptions, drawers } from './custody/drawers.js';

@Injectable()
export class CashCustodyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async employeeBranch(
    employee: PosEmployeeSession,
    branchId: string,
    manage = false,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    return requireEmployeeCashBranch(this.prisma, employee, branchId, manage, db);
  }

  async listSafes(merchantId: string, input: unknown): Promise<CursorPage<CashSafeSummary>> {
    return listSafes(this.prisma, merchantId, input);
  }

  async createSafe(merchantId: string, actor: string, input: unknown): Promise<{ id: string }> {
    return createSafe(this.prisma, merchantId, actor, input);
  }

  async listTransfers(
    merchantId: string,
    input: unknown,
    employee?: PosEmployeeSession,
  ): Promise<CursorPage<CashTransferSummary>> {
    return listTransfers(this.prisma, merchantId, input, employee);
  }

  async transferClosedCash(
    merchantId: string,
    actor: string,
    shiftId: string,
    input: unknown,
    employee?: PosEmployeeSession,
  ): Promise<CashTransferSummary> {
    return transferClosedCash(this.prisma, merchantId, actor, shiftId, input, employee);
  }

  async receive(
    merchantId: string,
    actor: string,
    id: string,
    input: unknown,
    employee?: PosEmployeeSession,
  ): Promise<CashTransferSummary> {
    return receive(this.prisma, merchantId, actor, id, input, employee);
  }

  async receiveForEmployee(
    employee: PosEmployeeSession,
    branchId: string,
    id: string,
    input: unknown,
  ): Promise<CashTransferSummary> {
    return receiveForEmployee(this.prisma, employee, branchId, id, input);
  }

  async resolve(
    merchantId: string,
    actor: string,
    id: string,
    input: unknown,
  ): Promise<CashTransferSummary> {
    return resolve(this.prisma, merchantId, actor, id, input);
  }

  async safeMovement(
    merchantId: string,
    actor: string,
    safeId: string,
    input: unknown,
  ): Promise<{ id: string }> {
    return safeMovement(this.prisma, merchantId, actor, safeId, input);
  }

  async safeLedger(
    merchantId: string,
    safeId: string,
    input: unknown,
  ): Promise<CursorPage<CashSafeMovementSummary>> {
    return safeLedger(this.prisma, merchantId, safeId, input);
  }

  drawerLedger(
    merchantId: string,
    shiftId: string,
    input: unknown,
  ): Promise<CursorPage<CashSafeMovementSummary>> {
    return drawerLedger(this.prisma, merchantId, shiftId, input);
  }

  async carryoverOptions(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<CursorPage<CashDrawerSummary>> {
    return carryoverOptions(this.prisma, employee, input);
  }

  async drawers(
    merchantId: string,
    input: unknown,
    employee?: PosEmployeeSession,
    closedOnly = false,
  ): Promise<CursorPage<CashDrawerSummary>> {
    return drawers(this.prisma, merchantId, input, employee, closedOnly);
  }
}
