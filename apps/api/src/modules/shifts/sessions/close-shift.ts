/** Closes a shift after checking payments, counted cash and the required approval. */
import { toCloseReport } from '../shift.mapper.js';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readDeliveryBalances } from '../delivery-reconciliation.js';
import {
  type PosDeliveryHandoverSnapshot,
  type PosEmployeeSession,
  type PosShiftCloseReport as PosShiftCloseReportContract,
  type PosShiftReconciliationSummary,
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
} from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { formatCents, toCents } from '../../../common/money/money.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { closePosShiftSchema, withoutShiftCloseApproval } from '../shifts.schemas.js';

import { shiftInclude, closeReportInclude } from '../shift-records.js';
import { buildShiftReconciliation } from '../reconciliation/shift-reconciliation.js';
import {
  readCurrentShiftPermissions,
  requireCurrentApprover,
  assertShiftBranchAssignment,
  requireShiftAccess,
} from '../access/shift-access.rules.js';

import { replayShiftClose } from './shift-close-replay.js';

export async function closeShift(
  prisma: PrismaService,
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
    .update(JSON.stringify({ shiftId, ...request, approverEmployeeId: approverEmployeeId ?? null }))
    .digest('hex');
  const previous = await prisma.posShiftCloseReport.findFirst({
    where: { merchantId: employee.merchantId, requestId: request.requestId },
    include: closeReportInclude,
  });
  if (previous) return replayShiftClose(prisma, employee, previous, shiftId, fingerprint);

  try {
    // 2. Check current cash and pending work before saving the final close report.
    return await prisma.$transaction(
      async (tx) => {
        const prior = await tx.posShiftCloseReport.findFirst({
          where: { merchantId: employee.merchantId, requestId: request.requestId },
          include: closeReportInclude,
        });
        if (prior) return replayShiftClose(prisma, employee, prior, shiftId, fingerprint, tx);

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
      const prior = await prisma.posShiftCloseReport.findFirst({
        where: { merchantId: employee.merchantId, requestId: request.requestId },
        include: closeReportInclude,
      });
      if (prior) return replayShiftClose(prisma, employee, prior, shiftId, fingerprint);
      throw new ConflictException(
        'The shift changed while closing. Refresh the reconciliation and retry.',
      );
    }
    throw error;
  }
}
