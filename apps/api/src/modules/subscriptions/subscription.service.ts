import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@waffarly/database';
import type {
  SubscriptionCommand,
  SubscriptionDetail,
  SubscriptionQuote,
  SubscriptionSummary,
  SubscriptionStatus,
  SubscriptionDashboard,
  SubscriptionMonths,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { formatCents, toCents } from '../../common/money/money.js';
import {
  addSubscriptionMonths,
  unusedSubscriptionCredit,
  effectiveSubscriptionStatus,
} from './subscription.rules.js';
import { subscriptionCommandSchema } from './subscription.schemas.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';

type Client = Prisma.TransactionClient;
const include = {
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
type RecordValue = Prisma.SubscriptionGetPayload<{ include: typeof include }>;
type Period = RecordValue['periods'][number];
function coverageInclude(client: Client) {
  return {
    ...include,
    periods: {
      ...include.periods,
      where: { coverageEndsAt: { gt: client.subscriptionPeriod.fields.startsAt } },
    },
  };
}
function mapPeriod(p: Period) {
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
function summary(s: RecordValue, now = new Date()): SubscriptionSummary {
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
    currentPeriod: current ? mapPeriod(current) : null,
  };
}

@Injectable()
export class SubscriptionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assignOnboarding(
    tx: Client,
    merchantId: string,
    input: { planId: string; months: SubscriptionMonths },
    administrator: string,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "monthly_plans" WHERE "id" = ${input.planId}::uuid FOR SHARE`,
    );
    await this.quote(merchantId, { ...input, action: 'activate' }, tx);
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

  async access(merchantId: string): Promise<{ allowed: boolean; status: SubscriptionStatus }> {
    const now = new Date();
    const s = await this.prisma.subscription.findUnique({
      where: { merchantId },
      include: {
        periods: { where: { startsAt: { lte: now }, coverageEndsAt: { gt: now } }, take: 1 },
      },
    });
    if (!s) return { allowed: false, status: 'pending' };
    const status = effectiveSubscriptionStatus(s.status, s.periods.length > 0);
    return { allowed: status === 'active' || status === 'legacy', status };
  }

  async requireActive(merchantId: string, tx?: Client) {
    if (!tx) {
      if (!(await this.access(merchantId)).allowed)
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

  async list(query: {
    cursor?: string | undefined;
    status?: SubscriptionStatus | undefined;
    q?: string | undefined;
    expiring?: boolean | undefined;
    planId?: string | undefined;
  }) {
    const now = new Date();
    const coverage = { startsAt: { lte: now }, coverageEndsAt: { gt: now } };
    const where: Prisma.SubscriptionWhereInput = {
      ...(query.cursor ? { merchantId: { gt: query.cursor } } : {}),
      ...(query.q
        ? {
            merchant: {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { ownerName: { contains: query.q, mode: 'insensitive' } },
                { contactPhone: { contains: query.q } },
                { ownerMobile: { contains: query.q } },
                { storefrontSlug: { contains: query.q, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      ...(query.planId
        ? {
            OR: [
              { periods: { some: { ...coverage, planId: query.planId } } },
              { assignedPlanId: query.planId, NOT: { periods: { some: coverage } } },
            ],
          }
        : {}),
      ...(query.status === 'expired'
        ? { status: 'active', NOT: { periods: { some: coverage } } }
        : query.status === 'active'
          ? {
              status: 'active',
              periods: { some: { ...coverage, ...(query.planId ? { planId: query.planId } : {}) } },
            }
          : query.status
            ? { status: query.status }
            : {}),
      ...(query.expiring
        ? {
            AND: [
              { status: 'active' },
              { periods: { some: coverage } },
              {
                NOT: {
                  periods: {
                    some: {
                      AND: [
                        { coverageEndsAt: { gt: new Date(now.getTime() + 7 * 86400000) } },
                        { coverageEndsAt: { gt: this.prisma.subscriptionPeriod.fields.startsAt } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.subscription.findMany({
      where,
      orderBy: { merchantId: 'asc' },
      take: 51,
      include: coverageInclude(this.prisma),
    });
    return {
      items: rows.slice(0, 50).map((row) => summary(row, now)),
      nextCursor: rows.length > 50 ? rows[49]!.merchantId : null,
    };
  }

  async dashboard(): Promise<SubscriptionDashboard> {
    const now = new Date();
    const coverage = { startsAt: { lte: now }, coverageEndsAt: { gt: now } };
    const [groups, active, expiringSoon, money] = await Promise.all([
      this.prisma.subscription.groupBy({ by: ['status'], _count: true }),
      this.prisma.subscription.count({ where: { status: 'active', periods: { some: coverage } } }),
      this.prisma.subscription.count({
        where: {
          status: 'active',
          periods: { some: coverage },
          NOT: {
            periods: {
              some: {
                AND: [
                  { coverageEndsAt: { gt: new Date(now.getTime() + 7 * 86400000) } },
                  { coverageEndsAt: { gt: this.prisma.subscriptionPeriod.fields.startsAt } },
                ],
              },
            },
          },
        },
      }),
      this.prisma.subscriptionEvent.aggregate({ _sum: { collected: true } }),
    ]);
    const counts: SubscriptionDashboard['counts'] = {
      pending: 0,
      active,
      expired: 0,
      suspended: 0,
      cancelled: 0,
      legacy: 0,
    };
    for (const group of groups) {
      if (group.status === 'active') counts.expired = group._count - active;
      else counts[group.status as SubscriptionStatus] = group._count;
    }
    return { counts, expiringSoon, collected: money._sum.collected?.toFixed(2) ?? '0.00' };
  }

  async detail(merchantId: string, client: Client = this.prisma): Promise<SubscriptionDetail> {
    const s = await client.subscription.findUnique({
      where: { merchantId },
      include: coverageInclude(client),
    });
    if (!s) throw new NotFoundException('Subscription was not found.');
    const events = await client.subscriptionEvent.findMany({
      where: { merchantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    const periods = await client.subscriptionPeriod.findMany({
      where: { merchantId },
      orderBy: [{ coverageEndsAt: 'desc' }, { startsAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    return {
      ...summary(s),
      periods: periods.slice(0, 50).map(mapPeriod),
      nextPeriodCursor: periods.length > 50 ? periods[49]!.id : null,
      nextEventCursor: events.length > 50 ? events[49]!.id : null,
      events: events.slice(0, 50).map((e) => ({
        id: e.id,
        action: e.action,
        administrator: e.administrator,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
        collected: e.collected.toFixed(2),
      })),
    };
  }

  async history(merchantId: string, kind: 'periods' | 'events', cursor?: string) {
    if (
      !(await this.prisma.subscription.findUnique({
        where: { merchantId },
        select: { merchantId: true },
      }))
    )
      throw new NotFoundException('Subscription was not found.');
    if (kind === 'periods') {
      if (
        cursor &&
        !(await this.prisma.subscriptionPeriod.findFirst({
          where: { id: cursor, merchantId },
          select: { id: true },
        }))
      )
        throw new BadRequestException('Invalid history cursor.');
      const rows = await this.prisma.subscriptionPeriod.findMany({
        where: { merchantId },
        orderBy: [{ coverageEndsAt: 'desc' }, { startsAt: 'desc' }, { id: 'desc' }],
        take: 51,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      return {
        items: rows.slice(0, 50).map(mapPeriod),
        nextCursor: rows.length > 50 ? rows[49]!.id : null,
      };
    }
    if (
      cursor &&
      !(await this.prisma.subscriptionEvent.findFirst({
        where: { id: cursor, merchantId },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Invalid history cursor.');
    const rows = await this.prisma.subscriptionEvent.findMany({
      where: { merchantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 50).map((e) => ({
        id: e.id,
        action: e.action,
        administrator: e.administrator,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
        collected: e.collected.toFixed(2),
      })),
      nextCursor: rows.length > 50 ? rows[49]!.id : null,
    };
  }

  async quote(
    merchantId: string,
    input: {
      action: 'activate' | 'renew' | 'change';
      planId: string;
      months: SubscriptionMonths;
      effectiveAt?: string | undefined;
    },
    client: Client = this.prisma,
  ): Promise<SubscriptionQuote> {
    const [s, plan] = await Promise.all([
      client.subscription.findUnique({ where: { merchantId }, include: coverageInclude(client) }),
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

  async command(
    merchantId: string,
    input: SubscriptionCommand,
    administrator: string,
  ): Promise<SubscriptionDetail> {
    input = parseRequest(subscriptionCommandSchema, input);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([administrator, input]))
      .digest('hex');
    try {
      return await this.prisma.$transaction(async (tx) => {
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
          include: coverageInclude(tx),
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
          await this.quote(
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
          const quote = await this.quote(
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
        const result = await this.detail(merchantId, tx);
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
}
