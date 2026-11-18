/**
 * Cancels eligible orders before preparation and handles the allowed stock return.
 * Cashier cancellations also close unpaid bills and release finished table sessions.
 */
import { ConflictException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';

import { InventoryLedgerService } from '../../inventory/index.js';

import { restoreOrderConsumption } from '../stock/order-stock.persistence.js';

import type {
  OrderForTransition,
  OrderTransitionCommand,
  PosCancellationActor,
} from './order-transition.types.js';

export async function cancelPosOrder(
  tx: Prisma.TransactionClient,
  order: OrderForTransition,
  command: Extract<OrderTransitionCommand, { action: 'pos_cancel' }>,
  merchantId: string,
  actor: string,
  ledger: InventoryLedgerService,
  posCancelActor?: PosCancellationActor,
): Promise<void> {
  const orderId = order.id;

  if (
    order.source !== 'pos' ||
    order.branchId !== posCancelActor?.branchId ||
    !['pending', 'accepted'].includes(order.status) ||
    order.preparationStartedAt
  )
    throw new ConflictException(
      'Only an unpaid POS order waiting for kitchen preparation can be cancelled.',
    );
  const paymentCount = await tx.posOrderPayment.count({
    where: { orderId, merchantId },
  });
  if (paymentCount > 0)
    throw new ConflictException('An order with any recorded payment must use a refund.');
  await restoreOrderConsumption(tx, ledger, merchantId, actor, orderId, command.input.reason);
  const reservedLines = await tx.storefrontOrderLine.findMany({
    where: { orderId, merchantId, stockReserved: true, variantId: { not: null } },
    select: { id: true, variantId: true, quantity: true },
  });
  for (const line of reservedLines) {
    if (!line.variantId) continue;
    const restored = await tx.productVariant.updateMany({
      where: { id: line.variantId, merchantId, stockQuantity: { not: null } },
      data: { stockQuantity: { increment: line.quantity } },
    });
    if (restored.count !== 1)
      throw new ConflictException('Reserved variant stock could not be restored safely.');
    await tx.storefrontOrderLine.updateMany({
      where: { id: line.id, orderId, merchantId, stockReserved: true },
      data: { stockReserved: false },
    });
  }
  await tx.storefrontOrder.update({
    where: { id: orderId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: command.input.reason,
      stockRestored: true,
      revision: { increment: 1 },
    },
  });
  await tx.posOrderCheck.updateMany({
    where: { orderId, merchantId, settledAt: null, cancelledAt: null },
    data: { cancelledAt: new Date(), revision: { increment: 1 } },
  });
  if (order.posDiningSessionId) {
    const session = await tx.posDiningSession.findFirst({
      where: { id: order.posDiningSessionId, merchantId, status: 'open' },
      select: { id: true, tableId: true, branchId: true },
    });
    if (session) {
      const tableLock = await tx.$queryRaw<Array<{ id: string }>>`
                  SELECT "id" FROM "pos_dining_tables"
                  WHERE "id" = ${session.tableId}::uuid
                    AND "branchId" = ${session.branchId}::uuid
                    AND "merchantId" = ${merchantId}::uuid
                  FOR UPDATE`;
      const sessionLock = tableLock.length
        ? await tx.$queryRaw<Array<{ id: string }>>`
                      SELECT "id" FROM "pos_dining_sessions"
                      WHERE "id" = ${session.id}::uuid AND "merchantId" = ${merchantId}::uuid
                        AND "status" = 'open' FOR UPDATE`
        : [];
      if (sessionLock.length) {
        const current = await tx.posDiningSession.findFirst({
          where: { id: session.id, merchantId, status: 'open', tableId: session.tableId },
          select: {
            id: true,
            orders: {
              select: {
                id: true,
                status: true,
                checks: { select: { settledAt: true, cancelledAt: true } },
              },
            },
          },
        });
        if (
          current &&
          current.orders.every((sessionOrder) =>
            ['completed', 'cancelled'].includes(sessionOrder.status),
          ) &&
          current.orders.every(
            (sessionOrder) =>
              sessionOrder.status === 'cancelled' ||
              (sessionOrder.checks.length > 0 &&
                sessionOrder.checks.every(
                  (check) => check.settledAt !== null || check.cancelledAt !== null,
                )),
          )
        ) {
          await tx.posDiningSession.updateMany({
            where: { id: session.id, merchantId, status: 'open' },
            data: { status: 'closed', closedAt: new Date(), revision: { increment: 1 } },
          });
        }
      }
    }
  }
}

export async function cancelAcceptedOrder(
  tx: Prisma.TransactionClient,
  order: OrderForTransition,
  command: Extract<OrderTransitionCommand, { action: 'cancel' }>,
  merchantId: string,
  actor: string,
  ledger: InventoryLedgerService,
): Promise<void> {
  const orderId = order.id;

  if (order.status !== 'accepted' || order.preparationStartedAt)
    throw new ConflictException('Cancellation is only allowed before preparation starts.');
  if (command.input.restoreStock) {
    await restoreOrderConsumption(tx, ledger, merchantId, actor, orderId, command.input.reason);
    // Mixed orders retain their original DIRECT/legacy reservations; restore them only on an explicit restock decision.
    for (const line of order.lines.filter(
      (line) => line.stockHandling === 'legacy' && line.stockReserved && line.variantId,
    )) {
      const restored = await tx.productVariant.updateMany({
        where: { id: line.variantId!, merchantId, stockQuantity: { not: null } },
        data: { stockQuantity: { increment: line.quantity } },
      });
      if (restored.count !== 1)
        throw new ConflictException(
          'A reserved variant cannot be restored; review its stock configuration.',
        );
    }
  }
  await tx.storefrontOrder.update({
    where: { id: orderId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: command.input.reason,
      stockRestored: command.input.restoreStock,
    },
  });
}
