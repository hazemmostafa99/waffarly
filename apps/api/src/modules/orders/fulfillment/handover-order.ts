/**
 * Hands a ready, paid order to the customer and closes its table session when everything is finished.
 */
import { ConflictException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';

import type { OrderForTransition } from './order-transition.types.js';

export async function handoverOrder(
  tx: Prisma.TransactionClient,
  order: OrderForTransition,
  merchantId: string,
): Promise<void> {
  const orderId = order.id;
  const isRoutedStorefrontOrder = order.source === 'storefront' && order.branchId !== null;

  if (
    await tx.posDelivery.findFirst({
      where: { orderId, merchantId },
      select: { orderId: true },
    })
  )
    throw new ConflictException('Confirm customer delivery from the delivery follow-up screen.');
  if (
    !(order.source === 'pos' && order.kitchenTicket) &&
    !(isRoutedStorefrontOrder && order.fulfillmentType === 'pickup' && order.posShiftId)
  )
    throw new ConflictException('Only ticketed POS orders can be handed over here.');
  if (order.status !== 'ready')
    throw new ConflictException('Only ready orders can be handed over.');

  // 1. Require full payment before handing this order to the customer.
  const checks = await tx.posOrderCheck.findMany({
    where: { orderId, merchantId },
    select: { id: true, settledAt: true, cancelledAt: true },
  });
  if (!checks.length || checks.some((check) => !check.settledAt))
    throw new ConflictException('Settle every check for this order before handover.');

  // 2. Review the current table session before deciding whether to release it.
  let sessionForClosure: {
    id: string;
    orders: Array<{
      id: string;
      status: string;
      checks: Array<{ settledAt: Date | null; cancelledAt: Date | null }>;
    }>;
  } | null = null;
  if (order.posDiningSessionId) {
    const session = await tx.posDiningSession.findFirst({
      where: { id: order.posDiningSessionId, merchantId, status: 'open' },
      select: { id: true, tableId: true, branchId: true },
    });
    if (!session) throw new ConflictException('The dining table session is no longer open.');
    const tableLock = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "pos_dining_tables"
                WHERE "id" = ${session.tableId}::uuid
                  AND "branchId" = ${session.branchId}::uuid
                  AND "merchantId" = ${merchantId}::uuid
                FOR UPDATE`;
    if (!tableLock.length) throw new ConflictException('The dining table is no longer available.');
    const sessionLock = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "pos_dining_sessions"
                WHERE "id" = ${session.id}::uuid
                  AND "merchantId" = ${merchantId}::uuid
                  AND "status" = 'open'
                FOR UPDATE`;
    if (!sessionLock.length)
      throw new ConflictException('The dining table session is no longer open.');
    const lockedSession = await tx.posDiningSession.findFirst({
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
    if (!lockedSession)
      throw new ConflictException('The dining table moved. Reload and retry handover.');
    sessionForClosure = lockedSession;
  }

  // 3. Complete the order and close the table only when all its orders are finished.
  const completedAt = new Date();
  await tx.storefrontOrder.update({
    where: { id: orderId },
    data: { status: 'completed', completedAt },
  });
  if (
    sessionForClosure &&
    sessionForClosure.orders.every(
      (sessionOrder) =>
        sessionOrder.id === orderId ||
        sessionOrder.status === 'completed' ||
        sessionOrder.status === 'cancelled',
    ) &&
    sessionForClosure.orders.every(
      (sessionOrder) =>
        sessionOrder.status === 'cancelled' ||
        (sessionOrder.checks.length > 0 &&
          sessionOrder.checks.every(
            (check) => check.settledAt !== null || check.cancelledAt !== null,
          )),
    )
  ) {
    await tx.posDiningSession.updateMany({
      where: { id: sessionForClosure.id, merchantId, status: 'open' },
      data: { status: 'closed', closedAt: completedAt, revision: { increment: 1 } },
    });
  }
}
