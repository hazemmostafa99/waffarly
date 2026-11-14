/** Reads and updates the merchant policy for stock consumption and negative balances. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type {
  InventoryPolicy,
  NegativeStockPolicy,
  UpdateInventoryPolicyRequest,
} from '@waffarly/contracts';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { inventoryPolicyUpdateSchema } from '../inventory.schemas.js';

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

export async function updatePolicy(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  input: UpdateInventoryPolicyRequest,
): Promise<InventoryPolicy> {
  const parsed = parseRequest(inventoryPolicyUpdateSchema, input);
  const changed = await prisma.merchant.updateMany({
    where: { id: merchantId, inventoryPolicyRevision: parsed.revision },
    data: {
      negativeStockPolicy: parsed.negativeStockPolicy,
      inventoryPolicyRevision: { increment: 1 },
      inventoryPolicyUpdatedBy: actor,
      inventoryPolicyUpdatedAt: new Date(),
    },
  });
  if (changed.count !== 1) {
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException('Merchant was not found.');
    throw new ConflictException('Inventory policy changed. Reload it before trying again.');
  }
  return getPolicy(prisma, merchantId);
}
