/** Updates merchant stock rules and shows their current settings. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { InventoryPolicy, UpdateInventoryPolicyRequest } from '@waffarly/contracts';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { inventoryPolicyUpdateSchema } from '../inventory.schemas.js';
import { getPolicy } from './inventory-policy.query.js';

@Injectable()
export class InventoryPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPolicy(merchantId: string): Promise<InventoryPolicy> {
    return getPolicy(this.prisma, merchantId);
  }

  async updatePolicy(
    merchantId: string,
    actor: string,
    input: UpdateInventoryPolicyRequest,
  ): Promise<InventoryPolicy> {
    const parsed = parseRequest(inventoryPolicyUpdateSchema, input);
    const changed = await this.prisma.merchant.updateMany({
      where: { id: merchantId, inventoryPolicyRevision: parsed.revision },
      data: {
        negativeStockPolicy: parsed.negativeStockPolicy,
        inventoryPolicyRevision: { increment: 1 },
        inventoryPolicyUpdatedBy: actor,
        inventoryPolicyUpdatedAt: new Date(),
      },
    });
    if (changed.count !== 1) {
      const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId } });
      if (!merchant) throw new NotFoundException('Merchant was not found.');
      throw new ConflictException('Inventory policy changed. Reload it before trying again.');
    }
    return getPolicy(this.prisma, merchantId);
  }
}
