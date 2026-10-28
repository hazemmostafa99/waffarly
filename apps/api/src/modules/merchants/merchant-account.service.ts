import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  MerchantAccountOverview,
  MerchantAccountProfile,
  OwnerSubscriptionHistory,
  UpdateMerchantAccountRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { SubscriptionService } from '../subscriptions/index.js';
import { updateMerchantAccountSchema } from './merchant-account.schemas.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';

@Injectable()
export class MerchantAccountService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SubscriptionService) private readonly subscriptions: SubscriptionService,
  ) {}

  async get(merchantId: string): Promise<MerchantAccountOverview> {
    return this.prisma.$transaction(
      async (tx) => ({
        profile: await this.profile(merchantId, tx),
        subscription: await this.subscriptions.ownerOverview(merchantId, tx),
      }),
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async profile(
    merchantId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<MerchantAccountProfile> {
    const merchant = await client.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        activity: true,
        contactPhone: true,
        ownerName: true,
        ownerMobile: true,
        storefrontSlug: true,
        createdAt: true,
        profileRevision: true,
        profileUpdatedAt: true,
        owner: { select: { username: true } },
        storefront: { select: { logoData: true } },
      },
    });
    if (!merchant) throw new NotFoundException('Merchant was not found.');
    return {
      merchantId: merchant.id,
      merchantName: merchant.name,
      activity: merchant.activity as MerchantAccountProfile['activity'],
      username: merchant.owner?.username ?? '',
      contactPhone: merchant.contactPhone,
      ownerName: merchant.ownerName,
      ownerMobile: merchant.ownerMobile,
      storefrontSlug: merchant.storefrontSlug,
      logoData: merchant.storefront?.logoData ?? null,
      createdAt: merchant.createdAt.toISOString(),
      revision: merchant.profileRevision,
      updatedAt: merchant.profileUpdatedAt?.toISOString() ?? null,
    };
  }

  async update(
    merchantId: string,
    actor: string,
    request: UpdateMerchantAccountRequest,
  ): Promise<MerchantAccountProfile> {
    const input = parseRequest(updateMerchantAccountSchema, request, { format: 'messages' });
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.merchant.updateMany({
        where: { id: merchantId, profileRevision: input.revision },
        data: {
          name: input.merchantName,
          contactPhone: input.contactPhone,
          ownerName: input.ownerName,
          ownerMobile: input.ownerMobile,
          profileRevision: { increment: 1 },
          profileUpdatedAt: new Date(),
          profileUpdatedBy: actor,
        },
      });
      if (changed.count !== 1) {
        if (!(await tx.merchant.findUnique({ where: { id: merchantId }, select: { id: true } })))
          throw new NotFoundException('Merchant was not found.');
        throw new ConflictException('Account details have changed. Refresh and try again.');
      }
      return this.profile(merchantId, tx);
    });
  }

  async history(merchantId: string, cursor?: string): Promise<OwnerSubscriptionHistory> {
    return this.subscriptions.history(merchantId, 'periods', cursor);
  }
}
