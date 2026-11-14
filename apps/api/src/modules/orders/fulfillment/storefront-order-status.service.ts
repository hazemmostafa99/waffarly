/**
 * Handles the existing website accept-or-reject action and returns held stock when an order is rejected.
 */
import { lockBranchOperationShift } from '../../shifts/index.js';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { StorefrontOrderStatus, StorefrontOrderSummary } from '@waffarly/contracts';

import { isSerializationConflict } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { InventoryLedgerService } from '../../inventory/index.js';

import { toSummary } from '../mapping/order.mapper.js';

import { restoreOrderConsumption } from '../stock/order-stock.persistence.js';
import { allocateCheckoutLineRevenue } from '../checkout/checkout-policy.js';

@Injectable()
export class StorefrontOrderStatusService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
  ) {}

  async updateStatus(
    merchantId: string,
    orderId: string,
    status: Extract<StorefrontOrderStatus, 'accepted' | 'rejected'>,
  ): Promise<StorefrontOrderSummary> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const target = await transaction.storefrontOrder.findFirst({
            where: { id: orderId, merchantId, source: 'storefront' },
            select: {
              branchId: true,
              merchant: { select: { restaurantProfile: { select: { merchantId: true } } } },
              discountRedemption: { select: { amount: true } },
              lines: { select: { id: true, position: true, lineTotal: true } },
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
              where: {
                merchantId,
                orderId,
                stockHandling: { in: ['recipe_acceptance', 'direct_acceptance'] },
              },
              select: { id: true },
            });
            if (recipe)
              throw new ConflictException('Inventory-tracked orders require branch-based acceptance.');
          }
          const acceptedAt = status === 'accepted' ? new Date() : null;
          const changed = await transaction.storefrontOrder.updateMany({
            where: { id: orderId, merchantId, source: 'storefront', status: 'pending' },
            data: { status, ...(acceptedAt ? { acceptedAt } : {}) },
          });
          if (changed.count !== 1) {
            const exists = await transaction.storefrontOrder.findFirst({
              where: { id: orderId, merchantId, source: 'storefront' },
              select: { id: true },
            });
            if (!exists) throw new NotFoundException('Order was not found.');
            throw new ConflictException('Only pending orders can be accepted or rejected.');
          }

          if (acceptedAt) {
            const revenueByLine = allocateCheckoutLineRevenue(
              target.lines.map((line) => ({
                id: line.id,
                position: line.position,
                lineTotal: line.lineTotal.toString(),
              })),
              target.discountRedemption?.amount.toString(),
            );
            for (const lineRevenue of revenueByLine) {
              const savedRevenue = await transaction.storefrontOrderLine.updateMany({
                where: {
                  id: lineRevenue.lineId,
                  merchantId,
                  recognizedRevenueAmount: null,
                  revenueRecognizedAt: null,
                },
                data: {
                  recognizedRevenueAmount: lineRevenue.revenueAmount,
                  revenueRecognizedAt: acceptedAt,
                },
              });
              if (savedRevenue.count !== 1) {
                throw new ConflictException('This order line already has a revenue recognition event.');
              }
            }
          }

          if (status === 'rejected') {
            await restoreOrderConsumption(
              transaction,
              this.ledger,
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
}
