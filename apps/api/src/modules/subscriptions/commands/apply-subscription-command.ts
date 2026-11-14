/** Applies an administrator subscription action and saves its coverage, collection and retry result together. */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@waffarly/database';
import type { SubscriptionCommand, SubscriptionDetail } from '@waffarly/contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { subscriptionCommandSchema } from '../subscription.schemas.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { subscriptionCoverageInclude } from '../subscription-record.mapper.js';
import { getSubscriptionDetails } from '../queries/subscription-queries.js';
import { quoteSubscriptionChange } from '../pricing/quote-subscription.js';

export async function applySubscriptionCommand(
  prisma: PrismaService,
  merchantId: string,
  input: SubscriptionCommand,
  administrator: string,
): Promise<SubscriptionDetail> {
  input = parseRequest(subscriptionCommandSchema, input);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([administrator, input]))
    .digest('hex');
  try {
    // Save the account change, coverage and recorded result together.
    return await prisma.$transaction(async (tx) => {
      // Locks also serialize retries and first writes, before checking the revision.
      const locked = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT "id" FROM "merchants" WHERE "id" = ${merchantId}::uuid FOR UPDATE`,
      );
      if (!locked.length) throw new NotFoundException('Merchant was not found.');
      const prior = await tx.subscriptionEvent.findUnique({
        where: { merchantId_requestId: { merchantId, requestId: input.requestId } },
      });
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictException('This request was already used for a different action.');
        return prior.result as unknown as SubscriptionDetail;
      }
      const s = await tx.subscription.findUnique({
        where: { merchantId },
        include: subscriptionCoverageInclude(tx),
      });
      if (!s) throw new NotFoundException('Subscription was not found.');
      if (s.revision !== input.revision)
        throw new ConflictException('Subscription changed. Refresh before trying again.');
      if (input.planId)
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "monthly_plans" WHERE "id" = ${input.planId}::uuid FOR SHARE`,
        );
      const now = new Date();
      let collected = '0.00';
      const data: Prisma.SubscriptionUpdateInput = { revision: { increment: 1 } };
      if (input.action === 'assign') {
        if (!['pending', 'legacy'].includes(s.status))
          throw new ConflictException('Use a plan change or renewal for this subscription.');
        if (!input.planId || !input.months)
          throw new BadRequestException('Choose a plan and duration.');
        await quoteSubscriptionChange(
          prisma,
          merchantId,
          { action: 'activate', planId: input.planId, months: input.months },
          tx,
        );
        data.assignedPlan = { connect: { id: input.planId } };
        data.assignedMonths = input.months;
      } else if (['activate', 'renew', 'change'].includes(input.action)) {
        if (!input.planId || !input.months || !input.externalCollectionConfirmed)
          throw new BadRequestException(
            'Choose a plan, duration, and confirm external collection.',
          );
        const quote = await quoteSubscriptionChange(
          prisma,
          merchantId,
          {
            ...input,
            action: input.action as 'activate' | 'renew' | 'change',
            planId: input.planId,
            months: input.months,
          },
          tx,
        );
        if (quote.planRevision !== input.planRevision || quote.due !== input.expectedDue)
          throw new ConflictException('The price changed. Review a new quote before collecting.');
        if (input.action === 'change') {
          if (!input.effectiveAt)
            throw new BadRequestException('Review a quote before changing the plan.');
          const current = s.periods.find((p) => p.startsAt <= now && p.coverageEndsAt > now)!;
          await tx.subscriptionPeriod.update({
            where: { id: current.id },
            data: { coverageEndsAt: new Date(quote.startsAt) },
          });
        }
        await tx.subscriptionPeriod.create({
          data: {
            merchantId,
            planId: quote.planId,
            planName: quote.planName,
            months: quote.months,
            price: quote.price,
            collected: quote.due,
            credit: quote.credit,
            startsAt: new Date(quote.startsAt),
            endsAt: new Date(quote.endsAt),
            coverageEndsAt: new Date(quote.endsAt),
          },
        });
        collected = quote.due;
        data.status = 'active';
        data.cancelAtEnd = false;
        data.assignedPlan = { connect: { id: quote.planId } };
        data.assignedMonths = quote.months;
        await tx.merchant.updateMany({
          where: { id: merchantId, firstMonthActivatedAt: null },
          data: {
            firstMonthActivatedAt: now,
            firstMonthActivatedBy: administrator,
          },
        });
      } else if (input.action === 'suspend') {
        if (!['active', 'legacy'].includes(s.status))
          throw new ConflictException('This subscription cannot be suspended.');
        data.status = 'suspended';
      } else if (input.action === 'resume') {
        if (s.status !== 'suspended')
          throw new ConflictException('Only a suspended subscription can be resumed.');
        data.status = s.periods.length ? 'active' : 'legacy';
      } else if (input.action === 'cancel') {
        if (s.status === 'cancelled')
          throw new ConflictException('Subscription is already cancelled.');
        data.status = 'cancelled';
        data.cancelAtEnd = false;
        for (const period of s.periods.filter((p) => p.coverageEndsAt > now)) {
          await tx.subscriptionPeriod.update({
            where: { id: period.id },
            data: { coverageEndsAt: period.startsAt > now ? period.startsAt : now },
          });
        }
      } else if (input.action === 'cancel-at-end' || input.action === 'keep-active') {
        if (s.status !== 'active')
          throw new ConflictException('Only an active subscription supports this action.');
        data.cancelAtEnd = input.action === 'cancel-at-end';
      } else throw new BadRequestException('Unknown subscription action.');
      await tx.subscription.update({ where: { merchantId }, data });
      // Event result contains the committed revision; retries return the original result.
      await tx.subscriptionEvent.create({
        data: {
          merchantId,
          requestId: input.requestId,
          fingerprint,
          action: input.action,
          administrator,
          reason: input.reason,
          collected,
          result: {},
        },
      });
      const result = await getSubscriptionDetails(prisma, merchantId, tx);
      await tx.subscriptionEvent.update({
        where: { merchantId_requestId: { merchantId, requestId: input.requestId } },
        data: { result: result as unknown as Prisma.InputJsonValue },
      });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      throw new ConflictException('Subscription changed. Refresh before trying again.');
    throw error;
  }
}
