/** Reads the saved stock policy for one merchant. */
import { NotFoundException } from '@nestjs/common';
import type { InventoryPolicy, NegativeStockPolicy } from '@waffarly/contracts';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

export async function getPolicy(
  prisma: PrismaService,
  merchantId: string,
): Promise<InventoryPolicy> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      negativeStockPolicy: true,
      inventoryPolicyRevision: true,
      inventoryPolicyUpdatedAt: true,
    },
  });
  if (!merchant) throw new NotFoundException('Merchant was not found.');
  return {
    negativeStockPolicy: merchant.negativeStockPolicy as NegativeStockPolicy,
    revision: merchant.inventoryPolicyRevision,
    updatedAt: merchant.inventoryPolicyUpdatedAt?.toISOString() ?? null,
  };
}
