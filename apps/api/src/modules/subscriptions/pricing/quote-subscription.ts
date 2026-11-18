/** Calculates the price, unused credit and collection needed for a proposed subscription change. */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { SubscriptionQuote, SubscriptionMonths } from '@waffarly/contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { formatCents, toCents } from '../../../common/money/money.js';
import { addSubscriptionMonths, unusedSubscriptionCredit } from '../subscription.rules.js';

import {
  type SubscriptionClient,
  subscriptionCoverageInclude,
} from '../subscription-record.mapper.js';

export async function quoteSubscriptionChange(
  prisma: PrismaService,
  merchantId: string,
  input: {
    action: 'activate' | 'renew' | 'change';
    planId: string;
    months: SubscriptionMonths;
    effectiveAt?: string | undefined;
  },
  client: SubscriptionClient = prisma,
): Promise<SubscriptionQuote> {
  const [s, plan] = await Promise.all([
    client.subscription.findUnique({
      where: { merchantId },
      include: subscriptionCoverageInclude(client),
    }),
    client.monthlyPlan.findUnique({ where: { id: input.planId }, include: { terms: true } }),
  ]);
  if (!s) throw new NotFoundException('Subscription was not found.');
  if (!plan || !plan.available) throw new BadRequestException('Select an available plan.');
  const price =
    input.months === 1
      ? plan.monthlyPrice.toFixed(2)
      : plan.terms.find((t) => t.months === input.months)?.price.toFixed(2);
  if (!price) throw new BadRequestException('This duration is not available for this plan.');
  const now = new Date();
  let startsAt = now;
  let credit = '0.00';
  const current = s.periods.find((p) => p.startsAt <= now && p.coverageEndsAt > now);
  const last = s.periods.find((p) => p.coverageEndsAt > p.startsAt);
  if (input.action === 'activate' && !['pending', 'legacy', 'cancelled'].includes(s.status))
    throw new ConflictException('Use renewal for an existing subscription.');
  if (input.action === 'renew') {
    if (s.status !== 'active' || s.cancelAtEnd)
      throw new ConflictException('Resume or restore renewal before renewing.');
    if (s.periods.some((p) => p.startsAt > now && p.coverageEndsAt > p.startsAt))
      throw new ConflictException(
        'A prepaid renewal already exists. Wait until it starts before renewing again.',
      );
    if (last && last.coverageEndsAt > now) startsAt = last.coverageEndsAt;
  }
  if (input.action === 'change') {
    if (s.status !== 'active' || !current || s.cancelAtEnd)
      throw new ConflictException('Only an active subscription can be changed immediately.');
    if (s.periods.some((p) => p.startsAt > now && p.coverageEndsAt > p.startsAt))
      throw new ConflictException(
        'A prepaid renewal already exists. Change the plan at the next renewal.',
      );
    if (input.effectiveAt) {
      startsAt = new Date(input.effectiveAt);
      if (
        !Number.isFinite(startsAt.getTime()) ||
        startsAt > now ||
        now.getTime() - startsAt.getTime() > 5 * 60000 ||
        startsAt < current.startsAt
      )
        throw new ConflictException('The quote expired. Request a new quote.');
    }
    credit = unusedSubscriptionCredit(
      current.price.toFixed(2),
      current.startsAt,
      current.endsAt,
      startsAt,
    );
  }
  const due = toCents(price) - toCents(credit);
  if (due < 0n)
    throw new BadRequestException('Choose a change at renewal; this change requires a refund.');
  return {
    action: input.action,
    subscriptionRevision: s.revision,
    planId: plan.id,
    planName: plan.name,
    planRevision: plan.revision,
    months: input.months,
    price,
    credit,
    due: formatCents(due),
    startsAt: startsAt.toISOString(),
    endsAt: addSubscriptionMonths(startsAt, input.months).toISOString(),
  };
}
