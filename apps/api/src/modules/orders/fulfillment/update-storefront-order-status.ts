/**
 * Handles the existing website accept-or-reject action and returns held stock when an order is rejected.
 */
import { lockBranchOperationShift } from '../../shifts/index.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { StorefrontOrderStatus, StorefrontOrderSummary } from '@waffarly/contracts';

import { isSerializationConflict } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { InventoryLedgerService } from '../../inventory/index.js';

import { toSummary } from '../mapping/order.mapper.js';

import { restoreOrderConsumption } from '../stock/order-stock.persistence.js';

export async function updateStorefrontOrderStatus(
  prisma: PrismaService,
  ledger: InventoryLedgerService,
  merchantId: string,
  orderId: string,
  status: Extract<StorefrontOrderStatus, 'accepted' | 'rejected'>,
): Promise<StorefrontOrderSummary> {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const target = await transaction.storefrontOrder.findFirst({
          where: { id: orderId, merchantId, source: 'storefront' },
          select: {
            branchId: true,
            merchant: { select: { restaurantProfile: { select: { merchantId: true } } } },
          },
        });
        if (!target) throw new NotFoundException('Order was not found.');
        if (target.branchId || target.merchant.restaurantProfile) {
          if (!(await lockBranchOperationShift(transaction, merchantId, target.branchId)))
            throw new ConflictException({
              message: "Open a cashier shift at this order's branch before changing its status.",
              code: 'ORDER_SHIFT_REQUIRED',
            });
        }
        if (status === 'accepted') {
          const recipe = await transaction.storefrontOrderLine.findFirst({
            where: { merchantId, orderId, stockHandling: 'recipe_acceptance' },
            select: { id: true },
          });
          if (recipe) throw new ConflictException('Recipe orders require branch-based acceptance.');
        }
        const changed = await transaction.storefrontOrder.updateMany({
          where: { id: orderId, merchantId, source: 'storefront', status: 'pending' },
          data: { status },
        });
        if (changed.count !== 1) {
          const exists = await transaction.storefrontOrder.findFirst({
            where: { id: orderId, merchantId, source: 'storefront' },
            select: { id: true },
          });
          if (!exists) throw new NotFoundException('Order was not found.');
          throw new ConflictException('Only pending orders can be accepted or rejected.');
        }

        if (status === 'rejected') {
          await restoreOrderConsumption(
            transaction,
            ledger,
            merchantId,
            'owner:order-rejection',
            orderId,
            'Rejected order stock reversal',
          );
          const reservedLines = await transaction.storefrontOrderLine.findMany({
            where: { orderId, merchantId, stockReserved: true, variantId: { not: null } },
            select: { variantId: true, quantity: true },
          });
          for (const line of reservedLines) {
            if (!line.variantId) continue;
            await transaction.productVariant.updateMany({
              where: {
                id: line.variantId,
                merchantId,
                stockQuantity: { not: null },
              },
              data: { stockQuantity: { increment: line.quantity } },
            });
          }
        }

        const saved = await transaction.storefrontOrder.findFirst({
          where: { id: orderId, merchantId },
          include: {
            lines: {
              orderBy: { position: 'asc' },
              include: {
                selections: { orderBy: [{ groupPosition: 'asc' }, { optionPosition: 'asc' }] },
                variantAttributes: { orderBy: { position: 'asc' } },
              },
            },
          },
        });
        if (!saved) throw new NotFoundException('Order was not found.');
        return toSummary(saved);
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isSerializationConflict(error)) {
      throw new ConflictException('Order changed while it was being updated. Please retry.');
    }
    throw error;
  }
}
