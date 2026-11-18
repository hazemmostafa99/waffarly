/**
 * Finds only the orders the current customer or guest is allowed to open.
 */
import { NotFoundException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { customerOrderProjection, toCustomerOrderDetails } from './customer-order.mapper.js';

export async function listCustomerOrders(
  db: PrismaService,
  scope: Prisma.CustomerOrderAccessWhereInput,
  cursor?: string,
) {
  if (
    cursor &&
    !(await db.customerOrderAccess.findFirst({
      where: { AND: [scope, { orderId: cursor }] },
      select: { orderId: true },
    }))
  )
    throw new NotFoundException('Order was not found.');
  const rows = await db.customerOrderAccess.findMany({
    where: scope,
    select: customerOrderProjection,
    orderBy: [{ createdAt: 'desc' }, { orderId: 'desc' }],
    take: 21,
    ...(cursor ? { cursor: { orderId: cursor }, skip: 1 } : {}),
  });
  return {
    items: rows.slice(0, 20).map(toCustomerOrderDetails),
    nextCursor: rows.length > 20 ? rows[19]!.orderId : null,
  };
}
export async function getCustomerOrderDetails(
  db: PrismaService,
  scope: Prisma.CustomerOrderAccessWhereInput,
  orderId: string,
) {
  const row = await db.customerOrderAccess.findFirst({
    where: { AND: [scope, { orderId }] },
    select: customerOrderProjection,
  });
  if (!row) throw new NotFoundException('Order was not found.');
  return toCustomerOrderDetails(row);
}
