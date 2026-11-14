/** Creates the merchant and owner with the selected subscription assignment in one operation. */
import { ConflictException } from '@nestjs/common';
import type { CreateMerchantRequest, MerchantSummary } from '@waffarly/contracts';
import { randomUUID } from 'node:crypto';

import { storefrontHandleSchema } from '../storefront-address.schemas.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { hashPassword } from '../../auth/index.js';
import { SubscriptionService } from '../../subscriptions/index.js';
import { toMerchantSummary } from '../merchant-record.mapper.js';
import { createStorefrontSlug } from './storefront-slug.js';

export async function createMerchant(
  prisma: PrismaService,
  subscriptions: SubscriptionService,
  input: CreateMerchantRequest,
  administrator = 'super-admin',
): Promise<MerchantSummary> {
  const storefrontHandle =
    input.storefrontHandle === undefined
      ? undefined
      : parseRequest(storefrontHandleSchema, input.storefrontHandle);
  const username = input.username.trim().toLowerCase();
  const existing = await prisma.ownerAccount.findUnique({ where: { username } });
  if (existing) throw new ConflictException('Username is already in use.');

  try {
    const id = randomUUID();
    const passwordHash = await hashPassword(input.password);
    return await prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          id,
          name: input.name.trim(),
          storefrontSlug: createStorefrontSlug(input.name, id),
          ...(storefrontHandle
            ? {
                storefrontHandle,
                storefrontHandleAssignedAt: new Date(),
                storefrontHandleAssignedBy: administrator,
              }
            : {}),
          activity: input.activity ?? 'other',
          contactPhone: input.contactPhone.trim(),
          ownerName: input.ownerName.trim(),
          ownerMobile: input.ownerMobile.trim(),
          owner: {
            create: { username, passwordHash },
          },
        },
        include: { owner: { select: { username: true } } },
      });
      if (input.subscription)
        await subscriptions.assignOnboarding(tx, id, input.subscription, administrator);
      return toMerchantSummary(merchant);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException('Username or storefront handle is already in use.');
    }
    throw error;
  }
}

export async function activateFirstMonth(
  merchantId: string,
  administratorUsername: string,
): Promise<MerchantSummary> {
  // Historical timestamp activation cannot create paid coverage or bypass suspension.
  void merchantId;
  void administratorUsername;
  throw new ConflictException('Activate a priced subscription from subscription management.');
}
