/** Archives or restores a stock item after checking its existing use. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { StockItem, StockItemRevisionRequest } from '@waffarly/contracts';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { stockItemRevisionSchema } from '../inventory.schemas.js';

import { includeUnits, toItem } from './stock-item.mapper.js';
import { assertMutableItem } from './stock-item-access.js';

export async function setArchived(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  archived: boolean,
  input: StockItemRevisionRequest,
): Promise<StockItem> {
  const { revision } = parseRequest(stockItemRevisionSchema, input);
  return prisma.$transaction(async (transaction) => {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "stock_items"
        WHERE "id" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
        FOR UPDATE`;
    if (locked.length !== 1) throw new NotFoundException('Stock item was not found.');
    if (archived) {
      const pendingSnapshot = await transaction.storefrontOrderLineStockRequirement.findFirst({
        where: {
          merchantId,
          stockItemId: id,
          orderLine: {
            is: {
              stockHandling: 'recipe_acceptance',
              order: { is: { status: 'pending' } },
            },
          },
        },
        select: { id: true },
      });
      if (pendingSnapshot)
        throw new ConflictException(
          'A stock item required by a pending recipe order cannot be archived.',
        );
      const cancellable = await transaction.stockMovement.findFirst({
        where: {
          merchantId,
          stockItemId: id,
          batch: { orderLinks: { some: { role: 'consumption', order: { status: 'accepted' } } } },
        },
        select: { id: true },
      });
      if (cancellable)
        throw new ConflictException(
          'Stock used by an order awaiting preparation cannot be archived.',
        );
      const productUse = await transaction.productInventoryComponent.findFirst({
        where: { merchantId, stockItemId: id },
        select: { id: true },
      });
      const modifierUse = await transaction.productModifierEffect.findFirst({
        where: { merchantId, stockItemId: id },
        select: { id: true },
      });
      if (productUse || modifierUse) {
        throw new ConflictException('A stock item used by a product or recipe cannot be archived.');
      }
      const balance = await transaction.stockBalance.findFirst({
        where: { merchantId, stockItemId: id, quantity: { not: 0 } },
        select: { id: true },
      });
      if (balance) {
        throw new ConflictException('A stock item with non-zero stock cannot be archived.');
      }
    }
    const changed = await transaction.stockItem.updateMany({
      where: { id, merchantId, revision, archivedAt: archived ? null : { not: null } },
      data: {
        archivedAt: archived ? new Date() : null,
        updatedBy: actor,
        revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) await assertMutableItem(transaction, merchantId, id);
    return toItem(
      await transaction.stockItem.findFirstOrThrow({
        where: { id, merchantId },
        include: includeUnits,
      }),
    );
  });
}
