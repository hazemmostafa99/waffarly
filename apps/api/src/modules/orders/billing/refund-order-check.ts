/**
 * Records an approved refund against the original payments.
 * It keeps the refund receipt and the returned cash amounts together.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type {
  PosEmployeeSession,
  PosRefundReceipt,
  RecordPosCheckRefundResponse,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { isPosEmployeeRole, resolvePosEmployeePermissions } from '@waffarly/contracts';
import { createHash, randomUUID } from 'node:crypto';
import { formatCents, toCents } from '../../../common/money/money.js';

import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { ShiftsService } from '../../shifts/index.js';

import {
  parseRecordPosCheckRefundRequest,
  withoutPosRefundApproval,
} from '../../payments/index.js';

import { requirePosSellPermission } from '../pos-sales/pos-order.rules.js';

export async function recordCheckRefund(
  context: { prisma: PrismaService; shifts: ShiftsService },
  employee: PosEmployeeSession,
  orderId: string,
  checkId: string,
  input: unknown,
  approverEmployeeId?: string,
): Promise<RecordPosCheckRefundResponse> {
  requirePosSellPermission(employee);
  const parsed = parseRecordPosCheckRefundRequest(input);
  const request = withoutPosRefundApproval(parsed);
  const actor = `pos:${employee.id}`;
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        orderId,
        checkId,
        ...request,
        approverEmployeeId: approverEmployeeId ?? null,
      }),
    )
    .digest('hex');
  try {
    // 1. Keep refund records, cash effects and the saved retry result atomic.
    return await context.prisma.$transaction(
      async (tx) => {
        const previous = await tx.storefrontOrderAction.findUnique({
          where: {
            merchantId_requestId: {
              merchantId: employee.merchantId,
              requestId: request.requestId,
            },
          },
        });
        if (previous) return replayPosRefund(previous, actor, fingerprint);

        const order = await tx.storefrontOrder.findFirst({
          where: {
            id: orderId,
            merchantId: employee.merchantId,
            source: 'pos',
            branchId: {
              in: employee.branches
                .filter((branch) => branch.archivedAt === null)
                .map((branch) => branch.id),
            },
          },
          select: {
            id: true,
            branchId: true,
            currency: true,
            revision: true,
            status: true,
            cancelledAt: true,
          },
        });
        if (!order?.branchId) throw new NotFoundException('The POS order was not found.');
        if (request.branchId !== order.branchId)
          throw new ForbiddenException('The refund branch does not match this order.');

        const actorRow = await tx.posEmployee.findFirst({
          where: {
            id: employee.id,
            merchantId: employee.merchantId,
            active: true,
            branches: {
              some: {
                merchantId: employee.merchantId,
                branchId: order.branchId,
                branch: { archivedAt: null },
              },
            },
          },
          select: { displayName: true, role: true, permissions: true },
        });
        const actorPermissions = actorRow
          ? resolvePosEmployeePermissions(
              isPosEmployeeRole(actorRow.role) ? actorRow.role : null,
              actorRow.permissions,
            )
          : [];
        if (!actorRow || !actorPermissions.includes('sell'))
          throw new ForbiddenException('This employee is no longer authorized to sell.');
        if (!approverEmployeeId && !actorPermissions.includes('approve_refunds'))
          throw new ForbiddenException('Supervisor approval is required to refund this check.');
        let approverName: string | null = null;
        if (approverEmployeeId) {
          if (approverEmployeeId === employee.id)
            throw new ForbiddenException('A different supervisor must approve this refund.');
          const approver = await tx.posEmployee.findFirst({
            where: {
              id: approverEmployeeId,
              merchantId: employee.merchantId,
              active: true,
              branches: {
                some: {
                  merchantId: employee.merchantId,
                  branchId: order.branchId,
                  branch: { archivedAt: null },
                },
              },
            },
            select: { displayName: true, role: true, permissions: true },
          });
          const approverPermissions = approver
            ? resolvePosEmployeePermissions(
                isPosEmployeeRole(approver.role) ? approver.role : null,
                approver.permissions,
              )
            : [];
          if (!approver || !approverPermissions.includes('approve_refunds'))
            throw new ForbiddenException('The supervisor approval is no longer valid.');
          approverName = approver.displayName;
        }

        await context.shifts.lockOpenShiftForRefund(tx, {
          merchantId: employee.merchantId,
          shiftId: request.refundShiftId,
          branchId: order.branchId,
          employee,
        });
        const lockedOrder = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "storefront_orders"
            WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid
            FOR UPDATE`;
        if (!lockedOrder.length) throw new NotFoundException('The POS order was not found.');
        const currentOrder = await tx.storefrontOrder.findFirstOrThrow({
          where: {
            id: orderId,
            merchantId: employee.merchantId,
            source: 'pos',
            branchId: order.branchId,
          },
          select: {
            id: true,
            branchId: true,
            currency: true,
            revision: true,
            status: true,
            cancelledAt: true,
          },
        });
        if (currentOrder.revision !== request.revision)
          throw new ConflictException(
            'This order changed. Reload its payment state before refunding.',
          );
        if (currentOrder.cancelledAt || ['cancelled', 'rejected'].includes(currentOrder.status))
          throw new ConflictException('A cancelled order cannot be refunded here.');

        const lockedChecks = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "pos_order_checks"
            WHERE "id" = ${checkId}::uuid AND "orderId" = ${orderId}::uuid
              AND "merchantId" = ${employee.merchantId}::uuid FOR UPDATE`;
        if (!lockedChecks.length) throw new NotFoundException('The POS check was not found.');
        const check = await tx.posOrderCheck.findFirst({
          where: { id: checkId, orderId, merchantId: employee.merchantId },
          select: { id: true, amount: true, settledAt: true, cancelledAt: true },
        });
        if (!check || check.cancelledAt)
          throw new ConflictException('This check cannot be refunded.');

        const originals = await tx.posOrderPayment.findMany({
          where: {
            id: { in: request.allocations.map((allocation) => allocation.paymentId) },
            merchantId: employee.merchantId,
            orderId,
            checkId,
          },
          include: { deliveryRemittances: { select: { amount: true } } },
        });
        if (originals.length !== request.allocations.length)
          throw new BadRequestException(
            'Every refund amount must refer to an original payment on this check.',
          );
        let totalCents = 0n;
        const normalized: Array<{
          payment: (typeof originals)[number];
          amount: string;
          cents: bigint;
          terminalReference: string | null;
        }> = [];
        for (const allocation of request.allocations) {
          const payment = originals.find((row) => row.id === allocation.paymentId);
          if (!payment)
            throw new BadRequestException('An original payment was not found on this check.');
          if (
            payment.cashCustody === 'courier' &&
            payment.deliveryRemittances.reduce((sum, r) => sum + toCents(r.amount.toFixed(2)), 0n) <
              toCents(payment.amount.toFixed(2))
          )
            throw new ConflictException(
              'Receive all courier cash for this payment before issuing a refund.',
            );
          const cents = toCents(allocation.amount);
          if (cents <= 0n)
            throw new BadRequestException('Refund amounts must be greater than zero.');
          if (payment.method === 'terminal' && !allocation.terminalReference?.trim())
            throw new BadRequestException(
              'Enter the reference from the completed terminal refund.',
            );
          if (payment.method === 'cash' && allocation.terminalReference)
            throw new BadRequestException('Cash refunds cannot include a terminal reference.');
          const previousRefunds = await tx.posOrderRefundTender.aggregate({
            where: {
              originalPaymentId: payment.id,
              originalPaymentShiftId: payment.shiftId,
              merchantId: employee.merchantId,
            },
            _sum: { amount: true },
          });
          const originalCents = toCents(payment.amount.toString());
          const alreadyRefunded = toCents(previousRefunds._sum.amount?.toString() ?? '0.00');
          if (alreadyRefunded + cents > originalCents)
            throw new ConflictException(
              'The requested refund exceeds the remaining amount for an original payment.',
            );
          totalCents += cents;
          normalized.push({
            payment,
            amount: formatCents(cents),
            cents,
            terminalReference: allocation.terminalReference?.trim() ?? null,
          });
        }
        if (totalCents <= 0n) throw new BadRequestException('Enter a refund amount.');

        const refundId = randomUUID();
        const issuedAt = new Date();
        const receiptNumber = `RFD-${refundId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
        const receipt: PosRefundReceipt = {
          id: refundId,
          requestId: request.requestId,
          receiptNumber,
          orderId,
          checkId,
          amount: formatCents(totalCents),
          currency: currentOrder.currency as 'EGP',
          reason: request.reason,
          issuedAt: issuedAt.toISOString(),
          createdByEmployeeId: employee.id,
          approvedByEmployeeId: approverEmployeeId ?? null,
          issuedBy: actorRow.displayName,
          approvedBy: approverName,
          tenders: normalized.map(({ payment, amount, terminalReference }) => ({
            originalPaymentId: payment.id,
            method: payment.method as 'cash' | 'terminal',
            amount,
            terminalReference,
          })),
        };
        await tx.posOrderRefund.create({
          data: {
            id: refundId,
            merchantId: employee.merchantId,
            orderId,
            checkId,
            shiftId: request.refundShiftId,
            requestId: request.requestId,
            createdByEmployeeId: employee.id,
            approvedByEmployeeId: approverEmployeeId ?? null,
            receiptNumber,
            reason: request.reason,
            amount: receipt.amount,
            currency: currentOrder.currency,
            issuedAt,
            snapshot: receipt as unknown as Prisma.InputJsonValue,
          },
        });
        for (const [position, tender] of normalized.entries()) {
          const row = await tx.posOrderRefundTender.create({
            data: {
              merchantId: employee.merchantId,
              refundId,
              shiftId: request.refundShiftId,
              originalPaymentId: tender.payment.id,
              originalPaymentShiftId: tender.payment.shiftId,
              position,
              method: tender.payment.method,
              amount: tender.amount,
              terminalReference: tender.terminalReference,
            },
            select: { id: true },
          });
          if (tender.payment.method === 'cash') {
            await context.shifts.recordCashRefund(tx, {
              merchantId: employee.merchantId,
              shiftId: request.refundShiftId,
              refundTenderId: row.id,
              operatorEmployeeId: employee.id,
              amount: formatCents(-tender.cents),
            });
          }
        }
        const changed = await tx.storefrontOrder.updateMany({
          where: { id: orderId, merchantId: employee.merchantId, revision: request.revision },
          data: { revision: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'This order changed. Reload its payment state before refunding.',
          );
        await tx.posOrderCheck.update({
          where: { id: checkId },
          data: { revision: { increment: 1 } },
        });
        const response: RecordPosCheckRefundResponse = {
          orderId,
          orderRevision: request.revision + 1,
          checkId,
          refund: receipt,
        };
        await tx.storefrontOrderAction.create({
          data: {
            merchantId: employee.merchantId,
            orderId,
            requestId: request.requestId,
            action: 'pos_refund',
            fingerprint,
            result: response as unknown as Prisma.InputJsonValue,
            createdBy: actor,
            approvedByPosEmployeeId: approverEmployeeId ?? null,
          },
        });
        return response;
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
      const previous = await context.prisma.storefrontOrderAction.findUnique({
        where: {
          merchantId_requestId: { merchantId: employee.merchantId, requestId: request.requestId },
        },
      });
      if (previous) return replayPosRefund(previous, actor, fingerprint);
      throw new ConflictException(
        'This order or payment changed concurrently. Reload and retry the same refund command.',
      );
    }
    throw error;
  }
}

export function replayPosRefund(
  previous: { action: string; fingerprint: string; createdBy: string; result: unknown },
  actor: string,
  fingerprint: string,
): RecordPosCheckRefundResponse {
  if (
    previous.action !== 'pos_refund' ||
    previous.createdBy !== actor ||
    previous.fingerprint !== fingerprint
  )
    throw new ConflictException('The request ID was already used for a different POS action.');
  return previous.result as RecordPosCheckRefundResponse;
}
