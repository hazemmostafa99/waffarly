import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PosAppearanceSummary, UpdatePosAppearanceRequest } from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class MerchantPosAppearanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(merchantId: string): Promise<PosAppearanceSummary> {
    const appearance = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { posAccent: true, posAppearanceRevision: true, posAppearanceUpdatedAt: true },
    });
    if (!appearance) throw new NotFoundException('Merchant was not found.');
    return {
      accent: appearance.posAccent as PosAppearanceSummary['accent'],
      revision: appearance.posAppearanceRevision,
      updatedAt: appearance.posAppearanceUpdatedAt.toISOString(),
    };
  }

  async update(
    merchantId: string,
    updatedBy: string,
    input: UpdatePosAppearanceRequest,
  ): Promise<PosAppearanceSummary> {
    const changed = await this.prisma.merchant.updateMany({
      where: { id: merchantId, posAppearanceRevision: input.revision },
      data: {
        posAccent: input.accent,
        posAppearanceRevision: { increment: 1 },
        posAppearanceUpdatedBy: updatedBy,
        posAppearanceUpdatedAt: new Date(),
      },
    });
    if (changed.count !== 1) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true },
      });
      if (!merchant) throw new NotFoundException('Merchant was not found.');
      throw new ConflictException('POS appearance has changed. Refresh and try again.');
    }
    return this.get(merchantId);
  }
}
