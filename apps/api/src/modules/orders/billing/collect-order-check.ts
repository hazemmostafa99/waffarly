import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PosEmployeeSession, RecordPosCheckPaymentResponse } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { isPosEmployeeRole, resolvePosEmployeePermissions } from '@waffarly/contracts';
import { createHash } from 'node:crypto';
import { formatCents, toCents } from '../../../common/money/money.js';

import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { ShiftsService } from '../../shifts/index.js';

import { parseRecordPosCheckPaymentRequest, PaymentsService } from '../../payments/index.js';

import { requirePosSellPermission } from '../pos-sales/pos-order.rules.js';
import { issueSettledCheckReceipt } from '../receipts/order-receipts.js';

export async function recordCheckPayment(
  context: { prisma: PrismaService; shifts: ShiftsService; payments: PaymentsService },
  employee: PosEmployeeSession,
  orderId: string,
  checkId: string,
  input: unknown,
): Promise<RecordPosCheckPaymentResponse> {
  requirePosSellPermission(employee);
  // 1. Validate the payment command and preserve its retry identity.
  const request = parseRecordPosCheckPaymentRequest(input);
  const actor = `pos:${employee.id}`;
  const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  try {
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
        if (previous) return replayPosPayment(previous, actor, fingerprint);

        // 2. Resolve the order branch and shift before taking financial locks.
        const observedOrder = await tx.storefrontOrder.findFirst({
          where: {
            id: orderId,
            merchantId: employee.merchantId,
            OR: [
              { source: 'pos' },
              {
                source: 'storefront',
                fulfillmentType: 'pickup',
                posShiftId: { not: null },
                status: { in: ['ready', 'completed'] },
              },
            ],
            branchId: { in: employee.branches.map((branch) => branch.id) },
          },
          select: { branchId: true, posShiftId: true, fulfillmentType: true, delivery: true },
        });
        if (!observedOrder) throw new NotFoundException('The POS order was not found.');
        if (!observedOrder.posShiftId || !observedOrder.branchId)
          throw new ConflictException('This order is not linked to a POS shift.');
        const deliveryPayment =
          request.cashCustody === 'courier' || Boolean(request.receivingShiftId);
        const paymentShiftId = request.receivingShiftId ?? observedOrder.posShiftId;
        if (deliveryPayment) {
          if (
            observedOrder.fulfillmentType !== 'delivery' ||
            !observedOrder.delivery ||
            observedOrder.delivery.status === 'failed'
          )
            throw new ConflictException(
              'Dispatch this delivery before recording a courier or later-shift payment.',
            );
          const actorRow = await tx.posEmployee.findFirst({
            where: {
              id: employee.id,
              merchantId: employee.merchantId,
              active: true,
              branches: {
                some: { branchId: observedOrder.branchId, branch: { archivedAt: null } },
              },
            },
            select: { role: true, permissions: true },
          });
          const permissions = actorRow
            ? resolvePosEmployeePermissions(
                isPosEmployeeRole(actorRow.role) ? actorRow.role : null,
                actorRow.permissions,
              )
            : [];
          if (
            !permissions.includes('sell') ||
            (observedOrder.delivery.custodianEmployeeId !== employee.id &&
              !permissions.includes('approve_shift_close'))
          )
            throw new ForbiddenException(
              'Only the responsible employee or a supervisor can record this delivery collection.',
            );
          const shiftIds = [
            ...new Set(
              [
                observedOrder.posShiftId,
                observedOrder.delivery.followupShiftId,
                paymentShiftId,
              ].filter((id): id is string => Boolean(id)),
            ),
          ].sort();
          for (const shiftId of shiftIds)
            await tx.$queryRaw`SELECT "id" FROM "pos_shifts" WHERE "id" = ${shiftId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR SHARE`;
        }
        if (request.cashCustody !== 'courier') {
          if (request.receivingShiftId && observedOrder.delivery)
            await context.shifts.lockDeliveryReceivingShift(tx, {
              merchantId: employee.merchantId,
              shiftId: paymentShiftId,
              branchId: observedOrder.branchId,
              followupShiftId: observedOrder.delivery.followupShiftId,
            });
          else
            await context.shifts.lockOpenShiftForPayment(tx, {
              merchantId: employee.merchantId,
              shiftId: paymentShiftId,
              branchId: observedOrder.branchId,
            });
        }
        await tx.$queryRaw`SELECT "id" FROM "storefront_orders" WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR UPDATE`;
        const order = await tx.storefrontOrder.findFirst({
          where: {
            id: orderId,
            merchantId: employee.merchantId,
            OR: [
              { source: 'pos' },
              {
                source: 'storefront',
                fulfillmentType: 'pickup',
                posShiftId: { not: null },
                status: { in: ['ready', 'completed'] },
              },
            ],
            branchId: { in: employee.branches.map((branch) => branch.id) },
          },
          select: {
            id: true,
            branchId: true,
            currency: true,
            posShiftId: true,
            revision: true,
            status: true,
            cancelledAt: true,
          },
        });
        if (!order) throw new NotFoundException('The POS order was not found.');
        if (order.revision !== request.revision)
          throw new ConflictException('This order changed. Reload it before taking payment.');
        if (order.cancelledAt || order.status === 'cancelled')
          throw new ConflictException('A cancelled order cannot be paid.');
        if (!order.posShiftId || !order.branchId)
          throw new ConflictException('This order is not linked to a POS shift.');
        if (order.posShiftId !== observedOrder.posShiftId)
          throw new ConflictException('This order changed. Reload it before taking payment.');
        if (deliveryPayment) {
          const delivery = await tx.posDelivery.findFirst({
            where: { orderId, merchantId: employee.merchantId },
          });
          if (!delivery || delivery.revision !== observedOrder.delivery?.revision)
            throw new ConflictException('Delivery responsibility changed. Refresh and retry.');
          await tx.posDelivery.update({
            where: { orderId },
            data: {
              revision: { increment: 1 },
              ...(request.receivingShiftId
                ? { followupShiftId: request.receivingShiftId, custodianEmployeeId: employee.id }
                : {}),
            },
          });
        }

        const lockedCheck = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "pos_order_checks"
            WHERE "id" = ${checkId}::uuid
              AND "orderId" = ${orderId}::uuid
              AND "merchantId" = ${employee.merchantId}::uuid
            FOR UPDATE
          `;
        if (lockedCheck.length === 0) throw new NotFoundException('The check was not found.');
        const check = await tx.posOrderCheck.findFirst({
          where: { id: checkId, orderId, merchantId: employee.merchantId },
        });
        if (!check) throw new NotFoundException('The check was not found.');
        if (check.settledAt || check.cancelledAt)
          throw new ConflictException('This check is already settled or cancelled.');

        const existingPayments = await tx.posOrderPayment.aggregate({
          where: { orderId, checkId, merchantId: employee.merchantId },
          _sum: { amount: true },
        });
        const alreadyPaid = toCents(existingPayments._sum.amount?.toString() ?? '0.00');
        const checkAmount = toCents(check.amount.toString());
        const balanceCents = checkAmount - alreadyPaid;
        if (balanceCents <= 0n) throw new ConflictException('This check has no remaining balance.');

        // 3. Record tenders inside this transaction; receipt issuance uses the same transaction.
        const tenderResult = await context.payments.recordCheckTenders(tx, {
          merchantId: employee.merchantId,
          orderId,
          checkId,
          shiftId: paymentShiftId,
          requestId: request.requestId,
          currency: order.currency,
          balanceDue: formatCents(balanceCents),
          employee,
          tenders: request.tenders,
          ...(request.cashCustody ? { cashCustody: request.cashCustody } : {}),
        });
        const paidAfter = checkAmount - toCents(tenderResult.balanceDue);
        const settledAt = paidAfter === checkAmount ? new Date() : null;
        const changed = await tx.storefrontOrder.updateMany({
          where: { id: orderId, merchantId: employee.merchantId, revision: request.revision },
          data: { revision: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ConflictException('This order changed. Reload it before taking payment.');
        const updatedCheck = await tx.posOrderCheck.update({
          where: { id: checkId },
          data: { revision: { increment: 1 }, settledAt },
          select: { id: true, amount: true, revision: true, settledAt: true },
        });
        const receipt = settledAt
          ? await issueSettledCheckReceipt(tx, employee, orderId, checkId, settledAt)
          : null;
        const response: RecordPosCheckPaymentResponse = {
          orderId,
          orderRevision: request.revision + 1,
          check: {
            id: updatedCheck.id,
            amount: updatedCheck.amount.toFixed(2),
            paidAmount: formatCents(paidAfter),
            balanceDue: tenderResult.balanceDue,
            revision: updatedCheck.revision,
            status: settledAt ? 'settled' : 'open',
            settledAt: updatedCheck.settledAt?.toISOString() ?? null,
            receipt: receipt
              ? {
                  id: receipt.id,
                  receiptNumber: receipt.receiptNumber,
                  issuedAt: receipt.issuedAt,
                }
              : null,
          },
          payments: tenderResult.payments,
          receipt,
        };
        await tx.storefrontOrderAction.create({
          data: {
            merchantId: employee.merchantId,
            orderId,
            requestId: request.requestId,
            action: 'pos_payment',
            fingerprint,
            result: response as unknown as Prisma.InputJsonValue,
            createdBy: actor,
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
      if (previous) return replayPosPayment(previous, actor, fingerprint);
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'This payment conflicts with a recent update. Reload and retry.',
        );
      throw new ConflictException('This order changed. Reload it before taking payment.');
    }
    throw error;
  }
}

export function replayPosPayment(
  previous: { action: string; fingerprint: string; createdBy: string; result: unknown },
  actor: string,
  fingerprint: string,
): RecordPosCheckPaymentResponse {
  if (
    previous.action !== 'pos_payment' ||
    previous.createdBy !== actor ||
    previous.fingerprint !== fingerprint
  ) {
    throw new ConflictException('The request ID was already used for a different POS action.');
  }
  return previous.result as RecordPosCheckPaymentResponse;
}
