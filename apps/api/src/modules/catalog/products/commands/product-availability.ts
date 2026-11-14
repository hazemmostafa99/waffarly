/** Archives, restores or removes a product while protecting products already used in orders. */
import { ConflictException, NotFoundException } from '@nestjs/common';

import { isSerializationConflict } from '../../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../../infrastructure/database/prisma.service.js';

import { getProduct } from '../queries/product-queries.js';

export async function archiveProduct(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  revision: number,
) {
  const changed = await prisma.product.updateMany({
    where: { id, merchantId, revision, archivedAt: null },
    data: { archivedAt: new Date(), updatedBy: actor, revision: { increment: 1 } },
  });
  if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
  return getProduct(prisma, merchantId, id);
}

export async function restoreProduct(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  revision: number,
) {
  const changed = await prisma.product.updateMany({
    where: { id, merchantId, revision, archivedAt: { not: null } },
    data: {
      archivedAt: null,
      availability: 'unavailable',
      updatedBy: actor,
      revision: { increment: 1 },
    },
  });
  if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
  return getProduct(prisma, merchantId, id);
}

export async function removeProduct(prisma: PrismaService, merchantId: string, id: string) {
  const product = await prisma.product.findFirst({ where: { id, merchantId } });
  if (!product) throw new NotFoundException('Product was not found.');
  try {
    await prisma.$transaction(
      async (transaction) => {
        const orderUse = await transaction.storefrontOrderLine.findFirst({
          where: { merchantId, productId: id },
          select: { id: true },
        });
        if (orderUse) {
          throw new ConflictException(
            'Products used in an order cannot be deleted; archive it instead.',
          );
        }
        await transaction.productImage.deleteMany({ where: { productId: id } });
        await transaction.productCategory.deleteMany({ where: { productId: id } });
        await transaction.product.delete({ where: { id } });
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (isSerializationConflict(error)) {
      throw new ConflictException('Product has order history and cannot be deleted.');
    }
    throw error;
  }
  return { deleted: true };
}
