/** Resolves a saved public storefront address without exposing merchant credentials. */
import { NotFoundException } from '@nestjs/common';
import { isStorefrontHandle, type PublicStorefrontAddress } from '@waffarly/contracts';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

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
