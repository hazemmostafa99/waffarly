/** Assigns a store public address and resolves it to the matching storefront. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  type MerchantSummary,
  isStorefrontHandle,
  type PublicStorefrontAddress,
} from '@waffarly/contracts';

import { storefrontHandleSchema } from '../storefront-address.schemas.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { toMerchantSummary } from '../merchant-record.mapper.js';

export async function assignStorefrontHandle(
  prisma: PrismaService,
  id: string,
  input: string,
  administrator: string,
): Promise<MerchantSummary> {
  const handle = parseRequest(storefrontHandleSchema, input);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.merchant.findUnique({
        where: { id },
        include: {
          owner: { select: { username: true } },
          subscription: {
            select: {
              status: true,
              periods: {
                where: { startsAt: { lte: new Date() }, coverageEndsAt: { gt: new Date() } },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });
      if (!current) throw new NotFoundException('Merchant was not found.');
      if (current.storefrontHandle === handle) return toMerchantSummary(current);
      if (current.storefrontHandle !== null) {
        throw new ConflictException(
          'This merchant already has a storefront address. Address changes are not supported.',
        );
      }
      const result = await tx.merchant.updateMany({
        where: { id, storefrontHandle: null },
        data: {
          storefrontHandle: handle,
          storefrontHandleAssignedAt: new Date(),
          storefrontHandleAssignedBy: administrator,
        },
      });
      if (result.count !== 1)
        throw new ConflictException('The storefront address changed. Refresh and try again.');
      return toMerchantSummary({ ...current, storefrontHandle: handle });
    });
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw new ConflictException('Storefront handle is already in use.');
    throw error;
  }
}

export async function resolveStorefrontHandle(
  prisma: PrismaService,
  handle: string,
): Promise<PublicStorefrontAddress> {
  // Public lookup exposes only the same public identifier already used in catalog URLs.
  if (!isStorefrontHandle(handle)) throw new NotFoundException('Storefront was not found.');
  const merchant = await prisma.merchant.findUnique({
    where: { storefrontHandle: handle },
    select: { storefrontSlug: true },
  });
  if (!merchant) throw new NotFoundException('Storefront was not found.');
  return { handle, storefrontSlug: merchant.storefrontSlug };
}
