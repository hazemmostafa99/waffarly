/** Opens and closes cashier shifts and records approved drawer cash movements. */
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CursorPage,
  PosDeliveryHandoverRecipient,
  PosEmployeeSession,
  PosShiftClosePreview,
  PosShiftCloseReport as PosShiftCloseReportContract,
  PosShiftCloseReportRow,
  PosShiftLiveSummary,
  PosShiftSummary,
  RecordPosShiftCashMovementResponse,
} from '@waffarly/contracts';
import {
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
  type PosDeliveryHandoverSnapshot,
  type PosShiftReconciliationSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { formatCents, toCents, toSignedCents } from '../../common/money/money.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  assertShiftBranchAssignment,
  readCurrentShiftPermissions,
  requireCurrentApprover,
  requireShiftAccess,
} from './access/shift-access.rules.js';
import { carryClosedCash, trackSafeDrop } from './cash-custody.persistence.js';
import { lockOpenShiftForCashMovement } from './cash-movements/lock-cash-movement.js';
import {
  lockDeliveryReceivingShift,
  lockOpenShiftForPayment,
  lockOpenShiftForRefund,
  lockOpenShiftForSale,
  recordCashRefund,
  recordCashSale,
} from './cash-movements/order-cash-ledger.js';
import { replayManualCashMovement } from './cash-movements/cash-movement.rules.js';
import { readDeliveryBalances } from './delivery-reconciliation.js';
import { getReconciliation, previewCloseShift } from './reconciliation/shift-preview.js';
import { buildShiftReconciliation } from './reconciliation/shift-reconciliation.js';
import {
  getCloseReport,
  getLatestCloseReport,
  listOwnerCloseReports,
} from './reports/close-report.queries.js';
import { replayShiftClose } from './sessions/shift-close-replay.js';
import {
  getCurrentShift,
  getShiftBranch,
  listDeliveryHandoverRecipients,
} from './sessions/shift-queries.js';
import { closeReportInclude, manualCashMovementInclude, shiftInclude } from './shift-records.js';
import {
  toCloseReport,
  toLiveShiftSummary,
  toManualCashMovementSummary,
  toMatchingRetry,
  toShiftSummary,
} from './shift.mapper.js';
import { normalizeOpeningFloat } from './shifts.rules.js';
import {
  closePosShiftSchema,
  openPosShiftSchema,
  recordPosShiftCashMovementSchema,
  withoutShiftCashMovementApproval,
  withoutShiftCloseApproval,
  type OwnerPosShiftCloseReportsInput,
} from './shifts.schemas.js';

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

  async listOwnerCloseReports(
    merchantId: string,
    input: OwnerPosShiftCloseReportsInput,
  ): Promise<CursorPage<PosShiftCloseReportRow>> {
    return listOwnerCloseReports(this.prisma, merchantId, input);
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
    requireShiftAccess(employee);
    const parsed = parseRequest(recordPosShiftCashMovementSchema, input);
    const request = withoutShiftCashMovementApproval(parsed);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({ shiftId, ...request, approverEmployeeId: approverEmployeeId ?? null }),
      )
      .digest('hex');
    const existing = await this.prisma.posShiftManualCashMovement.findFirst({
      where: { merchantId: employee.merchantId, requestId: request.requestId },
      include: manualCashMovementInclude,
    });
    if (existing)
      return replayManualCashMovement(this.prisma, employee, existing, shiftId, fingerprint);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const prior = await tx.posShiftManualCashMovement.findFirst({
            where: { merchantId: employee.merchantId, requestId: request.requestId },
            include: manualCashMovementInclude,
          });
          if (prior)
            return replayManualCashMovement(this.prisma, employee, prior, shiftId, fingerprint, tx);

          const shiftRow = await lockOpenShiftForCashMovement(tx, employee, shiftId);
          assertShiftBranchAssignment(employee, shiftRow.branchId);
          const actorPermissions = await readCurrentShiftPermissions(
            tx,
            employee,
            shiftRow.branchId,
          );
          if (!actorPermissions.includes('sell'))
            throw new ForbiddenException(
              'This employee is not authorized to change register cash.',
            );
          let approverEmployeeIdForRecord: string | null = null;
          if (actorPermissions.includes('manage_cash_movements')) {
            if (approverEmployeeId) {
              approverEmployeeIdForRecord = await requireCurrentApprover(
                tx,
                employee,
                shiftRow.branchId,
                approverEmployeeId,
                'manage_cash_movements',
              );
            }
          } else {
            if (!approverEmployeeId)
              throw new ForbiddenException('Supervisor approval is required for a cash movement.');
            approverEmployeeIdForRecord = await requireCurrentApprover(
              tx,
              employee,
              shiftRow.branchId,
              approverEmployeeId,
              'manage_cash_movements',
            );
          }
          if (request.kind === 'cash_drop' && request.safeId) {
            const currentShift = await tx.posShift.findFirstOrThrow({
              where: { id: shiftId, merchantId: employee.merchantId },
              include: shiftInclude,
            });
            const cash = await buildShiftReconciliation(tx, currentShift);
            if (toCents(request.amount) > toSignedCents(cash.expectedCash))
              throw new ConflictException('The cash drop exceeds available drawer cash.');
          }
          const movement = await tx.posShiftManualCashMovement.create({
            data: {
              merchantId: employee.merchantId,
              shiftId,
              requestId: request.requestId,
              fingerprint,
              kind: request.kind,
              amount: request.amount,
              dropReference: request.dropReference ?? null,
              reason: request.reason,
              operatorEmployeeId: employee.id,
              approvedByEmployeeId: approverEmployeeIdForRecord,
            },
            include: manualCashMovementInclude,
          });
          if (request.kind === 'cash_drop' && request.safeId) {
            await trackSafeDrop(tx, {
              merchantId: employee.merchantId,
              branchId: shiftRow.branchId,
              shiftId,
              safeId: request.safeId,
              movementId: movement.id,
              requestId: request.requestId,
              amount: request.amount,
              reference: request.dropReference!,
              reason: request.reason,
              actor: `pos:${employee.id}`,
              fingerprint,
            });
          }
          const shift = await tx.posShift.findFirstOrThrow({
            where: { id: shiftId, merchantId: employee.merchantId, status: 'open' },
            include: shiftInclude,
          });
          return {
            shiftId,
            reconciliation: toLiveShiftSummary(await buildShiftReconciliation(tx, shift)),
            movement: toManualCashMovementSummary(movement),
          };
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
        const prior = await this.prisma.posShiftManualCashMovement.findFirst({
          where: { merchantId: employee.merchantId, requestId: request.requestId },
          include: manualCashMovementInclude,
        });
        if (prior)
          return replayManualCashMovement(this.prisma, employee, prior, shiftId, fingerprint);
        throw new ConflictException(
          'The cash movement changed concurrently. Refresh the shift and retry.',
        );
      }
      throw error;
    }
  }

  async closeShift(
    employee: PosEmployeeSession,
    shiftId: string,
    input: unknown,
    approverEmployeeId?: string,
  ): Promise<PosShiftCloseReportContract> {
    requireShiftAccess(employee);
    // 1. Keep the exact close request so retrying cannot close the shift twice.
    const parsed = parseRequest(closePosShiftSchema, input);
    const request = withoutShiftCloseApproval(parsed);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({ shiftId, ...request, approverEmployeeId: approverEmployeeId ?? null }),
      )
      .digest('hex');
    const previous = await this.prisma.posShiftCloseReport.findFirst({
      where: { merchantId: employee.merchantId, requestId: request.requestId },
      include: closeReportInclude,
    });
    if (previous) return replayShiftClose(this.prisma, employee, previous, shiftId, fingerprint);

    try {
      // 2. Check current cash and pending work before saving the final close report.
      return await this.prisma.$transaction(
        async (tx) => {
          const prior = await tx.posShiftCloseReport.findFirst({
            where: { merchantId: employee.merchantId, requestId: request.requestId },
            include: closeReportInclude,
          });
          if (prior)
            return replayShiftClose(this.prisma, employee, prior, shiftId, fingerprint, tx);

          const locked = await tx.$queryRaw<Array<{ id: string; branchId: string }>>`
            SELECT s."id", s."branchId"
            FROM "pos_shifts" s
            INNER JOIN "pos_registers" r
              ON r."id" = s."registerId" AND r."branchId" = s."branchId"
                AND r."merchantId" = s."merchantId" AND r."active" = true
            WHERE s."id" = ${shiftId}::uuid
              AND s."merchantId" = ${employee.merchantId}::uuid
              AND s."status" = 'open'
            FOR UPDATE OF s`;
          const lockedShift = locked[0];
          if (!lockedShift)
            throw new ConflictException('This register shift is already closed or unavailable.');
          assertShiftBranchAssignment(employee, lockedShift.branchId);
          const actorPermissions = await readCurrentShiftPermissions(
            tx,
            employee,
            lockedShift.branchId,
          );
          if (!actorPermissions.includes('open_register_shift'))
            throw new ForbiddenException(
              'This employee is no longer authorized to close register shifts.',
            );

          let approvedByEmployeeId: string | null = null;
          if (approverEmployeeId) {
            approvedByEmployeeId = await requireCurrentApprover(
              tx,
              employee,
              lockedShift.branchId,
              approverEmployeeId,
              'approve_shift_close',
            );
          }
          const shift = await tx.posShift.findFirstOrThrow({
            where: { id: shiftId, merchantId: employee.merchantId, status: 'open' },
            include: shiftInclude,
          });
          const reconciliation = await buildShiftReconciliation(tx, shift);
          if (reconciliation.unsettledCheckCount > 0)
            throw new ConflictException('Settle or cancel every check before closing this shift.');
          let deliveryHandover: PosDeliveryHandoverSnapshot | null = null;
          if (reconciliation.pendingDeliveryCount) {
            if (!request.deliveryHandover || !approvedByEmployeeId)
              throw new ForbiddenException(
                'Pending deliveries require a named recipient and approval from a different supervisor.',
              );
            const recipient = await tx.posEmployee.findFirst({
              where: {
                merchantId: employee.merchantId,
                username: request.deliveryHandover.recipientUsername,
                active: true,
                branches: {
                  some: { branchId: lockedShift.branchId, branch: { archivedAt: null } },
                },
              },
              select: { id: true, displayName: true, role: true, permissions: true },
            });
            const recipientPermissions = recipient
              ? resolvePosEmployeePermissions(
                  isPosEmployeeRole(recipient.role) ? recipient.role : null,
                  recipient.permissions,
                )
              : [];
            if (
              !recipient ||
              recipient.id === employee.id ||
              !recipientPermissions.includes('sell') ||
              !recipientPermissions.includes('open_register_shift')
            )
              throw new ForbiddenException(
                'Choose a different active cashier or supervisor assigned to this branch.',
              );
            const deliveries = await readDeliveryBalances(tx, employee.merchantId, {
              shiftId,
              limit: 501,
            });
            if (deliveries.length > 500)
              throw new ConflictException(
                'Resolve deliveries until at most 500 follow-ups remain before closing.',
              );
            const approver = await tx.posEmployee.findFirstOrThrow({
              where: { id: approvedByEmployeeId, merchantId: employee.merchantId },
              select: { displayName: true },
            });
            deliveryHandover = {
              recipientEmployeeId: recipient.id,
              recipientName: recipient.displayName,
              approvedByName: approver.displayName,
              deliveries: deliveries.map((d) => ({
                orderId: d.orderId,
                courierName: d.courierName,
                status: d.status,
                customerDue: formatCents(toCents(d.customerDue)),
                courierCashHeld: formatCents(toCents(d.courierCashHeld)),
              })),
            };
            await tx.posDelivery.updateMany({
              where: {
                merchantId: employee.merchantId,
                orderId: { in: deliveries.map((d) => d.orderId) },
                followupShiftId: shiftId,
              },
              data: {
                custodianEmployeeId: recipient.id,
                followupShiftId: null,
                revision: { increment: 1 },
              },
            });
          } else if (request.deliveryHandover) {
            throw new ConflictException(
              'There are no pending deliveries to hand over. Refresh the shift.',
            );
          }
          const countedCash = formatCents(toCents(request.countedCash));
          const varianceCents = toCents(countedCash) - toCents(reconciliation.expectedCash);
          if (varianceCents !== 0n && !request.reason?.trim())
            throw new ConflictException('Enter a reason for the cash variance.');
          if (
            varianceCents !== 0n &&
            !approvedByEmployeeId &&
            !actorPermissions.includes('approve_shift_close')
          )
            throw new ForbiddenException('Supervisor approval is required for a cash variance.');

          const closedAt = new Date();
          const finalReconciliation: PosShiftReconciliationSummary = {
            ...reconciliation,
            countedCash,
            variance: formatCents(varianceCents),
          };
          const report = await tx.posShiftCloseReport.create({
            data: {
              merchantId: employee.merchantId,
              shiftId,
              requestId: request.requestId,
              fingerprint,
              operatorEmployeeId: employee.id,
              approvedByEmployeeId,
              currency: shift.currency,
              openingFloat: finalReconciliation.openingFloat,
              cashSales: finalReconciliation.cashSales,
              deliveryCashReceived: finalReconciliation.deliveryCashReceived ?? '0.00',
              ...(deliveryHandover
                ? { deliveryHandover: deliveryHandover as unknown as Prisma.InputJsonValue }
                : {}),
              cashRefunds: finalReconciliation.cashRefunds,
              cashIn: finalReconciliation.cashIn,
              cashOut: finalReconciliation.cashOut,
              cashDrop: finalReconciliation.cashDrop,
              expectedCash: finalReconciliation.expectedCash,
              countedCash,
              variance: formatCents(varianceCents),
              terminalSales: finalReconciliation.terminalSales,
              terminalRefunds: finalReconciliation.terminalRefunds,
              reason: request.reason?.trim() || null,
              snapshot: finalReconciliation as unknown as Prisma.InputJsonValue,
              closedAt,
            },
            include: closeReportInclude,
          });
          const changed = await tx.posShift.updateMany({
            where: { id: shiftId, merchantId: employee.merchantId, status: 'open' },
            data: { status: 'closed', closedAt },
          });
          if (changed.count !== 1)
            throw new ConflictException('This register shift was closed concurrently.');
          const savedReport = await tx.posShiftCloseReport.findFirstOrThrow({
            where: { id: report.id, merchantId: employee.merchantId },
            include: closeReportInclude,
          });
          return toCloseReport(savedReport);
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
        const prior = await this.prisma.posShiftCloseReport.findFirst({
          where: { merchantId: employee.merchantId, requestId: request.requestId },
          include: closeReportInclude,
        });
        if (prior) return replayShiftClose(this.prisma, employee, prior, shiftId, fingerprint);
        throw new ConflictException(
          'The shift changed while closing. Refresh the reconciliation and retry.',
        );
      }
      throw error;
    }
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
    requireShiftAccess(employee);
    // 1. Check the opening details and the employee access.
    const parsed = parseRequest(openPosShiftSchema, input);
    const openingFloat = normalizeOpeningFloat(parsed.openingFloat);

    try {
      // 2. Save the opening cash and any carryover with the shift.
      return await this.prisma.$transaction(async (tx) => {
        const prior = await tx.posShift.findFirst({
          where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
          include: shiftInclude,
        });
        if (prior)
          return toMatchingRetry(
            prior,
            employee,
            parsed.registerId,
            openingFloat,
            parsed.sourceShiftId,
          );

        const locked = await tx.$queryRaw<Array<{ id: string; branchId: string; active: boolean }>>`
          SELECT "id", "branchId", "active"
          FROM "pos_registers"
          WHERE "id" = ${parsed.registerId} AND "merchantId" = ${employee.merchantId}
          FOR UPDATE
        `;
        const register = locked[0];
        if (!register || !register.active) throw new NotFoundException('Register was not found.');
        assertShiftBranchAssignment(employee, register.branchId);

        if (parsed.sourceShiftId) {
          const permissions = await readCurrentShiftPermissions(tx, employee, register.branchId);
          if (!permissions.includes('open_register_shift'))
            throw new ForbiddenException('Shift opening is no longer permitted.');
        }

        // Another identical request may have committed while this transaction waited on the register lock.
        const committedRetry = await tx.posShift.findFirst({
          where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
          include: shiftInclude,
        });
        if (committedRetry) {
          return toMatchingRetry(
            committedRetry,
            employee,
            parsed.registerId,
            openingFloat,
            parsed.sourceShiftId,
          );
        }

        const current = await tx.posShift.findFirst({
          where: {
            merchantId: employee.merchantId,
            registerId: register.id,
            status: { in: ['open', 'closing'] },
          },
          select: { id: true },
        });
        if (current) throw new ConflictException('A shift is already open on this register.');

        const record = await tx.posShift.create({
          data: {
            merchantId: employee.merchantId,
            branchId: register.branchId,
            registerId: register.id,
            openRequestId: parsed.requestId,
            openedByEmployeeId: employee.id,
            openingFloat,
            currency: 'EGP',
            status: 'open',
          },
          include: shiftInclude,
        });
        if (parsed.sourceShiftId) {
          await carryClosedCash(tx, {
            merchantId: employee.merchantId,
            branchId: register.branchId,
            registerId: register.id,
            sourceShiftId: parsed.sourceShiftId,
            destinationShiftId: record.id,
            requestId: parsed.requestId,
            amount: openingFloat,
            actor: `pos:${employee.id}`,
          });
        }
        return toShiftSummary(record);
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const prior = await this.prisma.posShift.findFirst({
        where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
        include: shiftInclude,
      });
      if (prior)
        return toMatchingRetry(
          prior,
          employee,
          parsed.registerId,
          openingFloat,
          parsed.sourceShiftId,
        );
      throw new ConflictException('A shift is already open on this register.');
    }
  }
}
