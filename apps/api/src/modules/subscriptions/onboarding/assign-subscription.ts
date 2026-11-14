/** Assigns the selected plan when a merchant is created without inventing paid coverage. */
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@waffarly/database';
import type { SubscriptionMonths } from '@waffarly/contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { type SubscriptionClient } from '../subscription-record.mapper.js';
import { quoteSubscriptionChange } from '../pricing/quote-subscription.js';

export async function assignOnboarding(
  prisma: PrismaService,
  tx: SubscriptionClient,
  merchantId: string,
  input: { planId: string; months: SubscriptionMonths },
  administrator: string,
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "monthly_plans" WHERE "id" = ${input.planId}::uuid FOR SHARE`,
  );
  await quoteSubscriptionChange(prisma, merchantId, { ...input, action: 'activate' }, tx);
  await tx.subscription.update({
    where: { merchantId },
    data: {
      assignedPlanId: input.planId,
      assignedMonths: input.months,
      revision: { increment: 1 },
    },
  });
  await tx.subscriptionEvent.create({
    data: {
      merchantId,
      requestId: randomUUID(),
      fingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      action: 'assign',
      administrator,
      reason: 'Assigned during merchant creation.',
      result: {},
    },
  });
}
