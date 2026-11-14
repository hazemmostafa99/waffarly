/** Determines whether a merchant currently has subscription access. */
import { ForbiddenException } from '@nestjs/common';

import { Prisma } from '@waffarly/database';
import type { SubscriptionStatus } from '@waffarly/contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { effectiveSubscriptionStatus } from '../subscription.rules.js';

import { type SubscriptionClient } from '../subscription-record.mapper.js';

export async function readSubscriptionAccess(
  prisma: PrismaService,
  merchantId: string,
): Promise<{ allowed: boolean; status: SubscriptionStatus }> {
  const now = new Date();
  const s = await prisma.subscription.findUnique({
    where: { merchantId },
    include: {
      periods: { where: { startsAt: { lte: now }, coverageEndsAt: { gt: now } }, take: 1 },
    },
  });
  if (!s) return { allowed: false, status: 'pending' };
  const status = effectiveSubscriptionStatus(s.status, s.periods.length > 0);
  return { allowed: status === 'active' || status === 'legacy', status };
}

export async function requireActive(
  prisma: PrismaService,
  merchantId: string,
  tx?: SubscriptionClient,
) {
  if (!tx) {
    if (!(await readSubscriptionAccess(prisma, merchantId)).allowed)
      throw new ForbiddenException('Subscription is not active.');
    return;
  }
  // Subscription actions lock the merchant exclusively, so checkout cannot cross a suspension.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "merchants" WHERE "id" = ${merchantId}::uuid FOR SHARE`,
  );
  const now = new Date();
  const subscription = await tx.subscription.findUnique({
    where: { merchantId },
    include: {
      periods: { where: { startsAt: { lte: now }, coverageEndsAt: { gt: now } }, take: 1 },
    },
  });
  if (
    !subscription ||
    (subscription.status !== 'legacy' &&
      !(subscription.status === 'active' && subscription.periods.length))
  )
    throw new ForbiddenException('Subscription is not active.');
}
