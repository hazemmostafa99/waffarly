import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PosEmployeeSession } from '@waffarly/contracts';

import { createHash, randomUUID } from 'node:crypto';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { ShiftsService } from '../../shifts/index.js';

import { requirePosSellPermission } from '../pos-sales/pos-order.rules.js';

export async function preparePickupCollection(
  context: { prisma: PrismaService; shifts: ShiftsService },
  employee: PosEmployeeSession,
  orderId: string,
  registerId: string,
) {
  requirePosSellPermission(employee);
  return context.prisma.$transaction(
    async (tx) => {
      const shift = await context.shifts.lockOpenShiftForSale(tx, employee, registerId);
      await tx.$queryRaw`SELECT "id" FROM "storefront_orders" WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR UPDATE`;
      const order = await tx.storefrontOrder.findFirst({
        where: {
          id: orderId,
          merchantId: employee.merchantId,
          source: 'storefront',
          fulfillmentType: 'pickup',
          branchId: shift.branchId,
          branch: { archivedAt: null },
        },
        select: {
          id: true,
          total: true,
          status: true,
          posShiftId: true,
          checks: { select: { id: true } },
        },
      });
      if (!order) throw new NotFoundException('Pickup order was not found at this branch.');
      if (order.status !== 'ready')
        throw new ConflictException('Only ready pickup orders can be collected.');
      if (order.posShiftId) {
        if (order.posShiftId !== shift.id || order.checks.length !== 1)
          throw new ConflictException('This collection is already assigned to another shift.');
        return { orderId: order.id };
      }
      if (order.checks.length)
        throw new ConflictException('Review this order collection before continuing.');
      await tx.storefrontOrder.update({
        where: { id: orderId },
        data: { posShiftId: shift.id, revision: { increment: 1 } },
      });
      await tx.posOrderCheck.create({
        data: {
          merchantId: employee.merchantId,
          orderId,
          position: 0,
          amount: order.total,
          splitMethod: 'whole',
        },
      });
      await tx.storefrontOrderAction.create({
        data: {
          merchantId: employee.merchantId,
          orderId,
          requestId: randomUUID(),
          action: 'pickup_collection',
          fingerprint: createHash('sha256')
            .update(JSON.stringify({ orderId, shiftId: shift.id }))
            .digest('hex'),
          result: { orderId, shiftId: shift.id },
          createdBy: `pos:${employee.id}`,
        },
      });
      return { orderId: order.id };
    },
    { isolationLevel: 'Serializable' },
  );
}
