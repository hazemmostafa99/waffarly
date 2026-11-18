/** Prepares paid subscription periods and account summaries for display. */
import { Prisma } from '@waffarly/database';
import type { SubscriptionSummary, SubscriptionMonths } from '@waffarly/contracts';

import { effectiveSubscriptionStatus } from './subscription.rules.js';

export type SubscriptionClient = Prisma.TransactionClient;

export const subscriptionRecordInclude = {
  merchant: { select: { name: true } },
  periods: {
    orderBy: [
      { coverageEndsAt: 'desc' as const },
      { startsAt: 'desc' as const },
      { id: 'desc' as const },
    ],
    take: 51,
  },
};

export type SubscriptionRecord = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionRecordInclude;
}>;

export type SubscriptionPeriodRecord = SubscriptionRecord['periods'][number];

export function subscriptionCoverageInclude(client: SubscriptionClient) {
  return {
    ...subscriptionRecordInclude,
    periods: {
      ...subscriptionRecordInclude.periods,
      where: { coverageEndsAt: { gt: client.subscriptionPeriod.fields.startsAt } },
    },
  };
}

export function toSubscriptionPeriod(p: SubscriptionPeriodRecord) {
  return {
    id: p.id,
    planId: p.planId,
    planName: p.planName,
    months: p.months as SubscriptionMonths,
    price: p.price.toFixed(2),
    collected: p.collected.toFixed(2),
    credit: p.credit.toFixed(2),
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    coverageEndsAt: p.coverageEndsAt.toISOString(),
  };
}

export function toSubscriptionSummary(
  s: SubscriptionRecord,
  now = new Date(),
): SubscriptionSummary {
  const current = s.periods.find((p) => p.startsAt <= now && p.coverageEndsAt > now);
  const last = s.periods.find((p) => p.coverageEndsAt > p.startsAt);
  const status = effectiveSubscriptionStatus(s.status, Boolean(current));
  return {
    merchantId: s.merchantId,
    merchantName: s.merchant.name,
    status,
    revision: s.revision,
    cancelAtEnd: s.cancelAtEnd,
    endsAt: last?.coverageEndsAt.toISOString() ?? null,
    assignedPlanId: s.assignedPlanId,
    assignedMonths: s.assignedMonths as SubscriptionMonths | null,
    currentPeriod: current ? toSubscriptionPeriod(current) : null,
  };
}
