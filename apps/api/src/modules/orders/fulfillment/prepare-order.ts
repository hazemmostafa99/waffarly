/**
 * Starts preparation and marks whole orders or individual kitchen items ready.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';

import type { OrderForTransition, OrderTransitionCommand } from './order-transition.types.js';

export async function startOrderPreparation(
  tx: Prisma.TransactionClient,
  order: OrderForTransition,
): Promise<void> {
  const orderId = order.id;

  if (order.status !== 'accepted' || order.preparationStartedAt)
    throw new ConflictException('Only accepted orders awaiting preparation can start preparation.');
  await tx.storefrontOrder.update({
    where: { id: orderId },
    data: { status: 'preparing', preparationStartedAt: new Date() },
  });
}

export async function markWholeOrderReady(
  tx: Prisma.TransactionClient,
  order: OrderForTransition,
): Promise<void> {
  const orderId = order.id;
  const isDispatchedPosOrder = order.source === 'pos' && order.kitchenTicket !== null;

  if (order.status !== 'preparing')
    throw new ConflictException('Only orders being prepared can be marked ready.');
  if (isDispatchedPosOrder)
    throw new ConflictException('Mark each kitchen item ready before handover.');
  await tx.storefrontOrder.update({
    where: { id: orderId },
    data: { status: 'ready', readyAt: new Date() },
  });
}

export async function markKitchenLineReady(
  tx: Prisma.TransactionClient,
  order: OrderForTransition,
  command: Extract<OrderTransitionCommand, { action: 'ready_item' }>,
  merchantId: string,
): Promise<void> {
  const orderId = order.id;
  const isDispatchedPosOrder = order.source === 'pos' && order.kitchenTicket !== null;

  if (!isDispatchedPosOrder)
    throw new ConflictException('Item readiness is only available for POS kitchen tickets.');
  const line = order.lines.find((candidate) => candidate.id === command.lineId);
  if (!line) throw new NotFoundException('Kitchen item was not found.');
  if (line.kitchenReadyAt) {
    if (order.status !== 'ready')
      throw new ConflictException('This ticket readiness changed. Refresh and retry.');
  } else {
    if (order.status !== 'preparing')
      throw new ConflictException('Start preparation before marking an item ready.');
    const itemReadyAt = new Date();
    const updated = await tx.storefrontOrderLine.updateMany({
      where: { id: line.id, orderId, merchantId, kitchenReadyAt: null },
      data: { kitchenReadyAt: itemReadyAt },
    });
    if (updated.count !== 1)
      throw new ConflictException('This kitchen item changed. Refresh and retry.');
    const allItemsReady = order.lines.every(
      (candidate) => candidate.id === line.id || candidate.kitchenReadyAt !== null,
    );
    if (allItemsReady)
      await tx.storefrontOrder.update({
        where: { id: orderId },
        data: { status: 'ready', readyAt: itemReadyAt },
      });
  }
}
