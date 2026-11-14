/** Reads subscription accounts, summaries, paid periods and administrative history. */
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { Prisma } from '@waffarly/database';
import type {
  SubscriptionDetail,
  SubscriptionStatus,
  SubscriptionDashboard,
  SubscriptionMonths,
  OwnerSubscriptionOverview,
  CursorPage,
  SubscriptionPeriodSummary,
  SubscriptionEventSummary,
} from '@waffarly/contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { effectiveSubscriptionStatus } from '../subscription.rules.js';

import {
  type SubscriptionClient,
  subscriptionCoverageInclude,
  toSubscriptionPeriod,
  toSubscriptionSummary,
} from '../subscription-record.mapper.js';

export async function ownerOverview(
  prisma: PrismaService,
  merchantId: string,
  client: SubscriptionClient = prisma,
): Promise<OwnerSubscriptionOverview> {
  const now = new Date();
  const validCoverage = { gt: client.subscriptionPeriod.fields.startsAt };
  const [account, current, next, latest, coverage] = await Promise.all([
    client.subscription.findUnique({
      where: { merchantId },
      select: {
        status: true,
        cancelAtEnd: true,
        assignedMonths: true,
        assignedPlan: { select: { name: true } },
      },
    }),
    client.subscriptionPeriod.findFirst({
      where: { merchantId, startsAt: { lte: now }, coverageEndsAt: { gt: now } },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    }),
    client.subscriptionPeriod.findFirst({
      where: { merchantId, startsAt: { gt: now }, coverageEndsAt: validCoverage },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    }),
    client.subscriptionPeriod.findFirst({
      where: { merchantId, startsAt: { lte: now } },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    }),
    client.subscriptionPeriod.aggregate({
      where: { merchantId, coverageEndsAt: validCoverage },
      _max: { coverageEndsAt: true },
    }),
  ]);
  return {
    status: effectiveSubscriptionStatus(account?.status ?? 'pending', Boolean(current)),
    currency: 'EGP',
    cancelAtEnd: account?.cancelAtEnd ?? false,
    assignedPlanName: account?.assignedPlan?.name ?? null,
    assignedMonths: (account?.assignedMonths as SubscriptionMonths | null) ?? null,
    currentPeriod: current ? toSubscriptionPeriod(current) : null,
    nextPeriod: next ? toSubscriptionPeriod(next) : null,
    latestPeriod: latest ? toSubscriptionPeriod(latest) : null,
    coverageEndsAt: coverage._max.coverageEndsAt?.toISOString() ?? null,
    asOf: now.toISOString(),
  };
}

export async function listSubscriptions(
  prisma: PrismaService,
  query: {
    cursor?: string | undefined;
    status?: SubscriptionStatus | undefined;
    q?: string | undefined;
    expiring?: boolean | undefined;
    planId?: string | undefined;
  },
) {
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
                      { coverageEndsAt: { gt: prisma.subscriptionPeriod.fields.startsAt } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
  const rows = await prisma.subscription.findMany({
    where,
    orderBy: { merchantId: 'asc' },
    take: 51,
    include: subscriptionCoverageInclude(prisma),
  });
  return {
    items: rows.slice(0, 50).map((row) => toSubscriptionSummary(row, now)),
    nextCursor: rows.length > 50 ? rows[49]!.merchantId : null,
  };
}

export async function dashboard(prisma: PrismaService): Promise<SubscriptionDashboard> {
  const now = new Date();
  const coverage = { startsAt: { lte: now }, coverageEndsAt: { gt: now } };
  const [groups, active, expiringSoon, money] = await Promise.all([
    prisma.subscription.groupBy({ by: ['status'], _count: true }),
    prisma.subscription.count({ where: { status: 'active', periods: { some: coverage } } }),
    prisma.subscription.count({
      where: {
        status: 'active',
        periods: { some: coverage },
        NOT: {
          periods: {
            some: {
              AND: [
                { coverageEndsAt: { gt: new Date(now.getTime() + 7 * 86400000) } },
                { coverageEndsAt: { gt: prisma.subscriptionPeriod.fields.startsAt } },
              ],
            },
          },
        },
      },
    }),
    prisma.subscriptionEvent.aggregate({ _sum: { collected: true } }),
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

export async function getSubscriptionDetails(
  prisma: PrismaService,
  merchantId: string,
  client: SubscriptionClient = prisma,
): Promise<SubscriptionDetail> {
  const s = await client.subscription.findUnique({
    where: { merchantId },
    include: subscriptionCoverageInclude(client),
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
    ...toSubscriptionSummary(s),
    periods: periods.slice(0, 50).map(toSubscriptionPeriod),
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

export async function listSubscriptionHistory(
  prisma: PrismaService,
  merchantId: string,
  kind: 'periods',
  cursor?: string,
): Promise<CursorPage<SubscriptionPeriodSummary>>;

export async function listSubscriptionHistory(
  prisma: PrismaService,
  merchantId: string,
  kind: 'events',
  cursor?: string,
): Promise<CursorPage<SubscriptionEventSummary>>;

export async function listSubscriptionHistory(
  prisma: PrismaService,
  merchantId: string,
  kind: 'periods' | 'events',
  cursor?: string,
): Promise<CursorPage<SubscriptionPeriodSummary> | CursorPage<SubscriptionEventSummary>>;

export async function listSubscriptionHistory(
  prisma: PrismaService,
  merchantId: string,
  kind: 'periods' | 'events',
  cursor?: string,
) {
  if (
    !(await prisma.subscription.findUnique({
      where: { merchantId },
      select: { merchantId: true },
    }))
  )
    throw new NotFoundException('Subscription was not found.');
  if (kind === 'periods') {
    if (
      cursor &&
      !(await prisma.subscriptionPeriod.findFirst({
        where: { id: cursor, merchantId },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Invalid history cursor.');
    const rows = await prisma.subscriptionPeriod.findMany({
      where: { merchantId },
      orderBy: [{ coverageEndsAt: 'desc' }, { startsAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, 50).map(toSubscriptionPeriod),
      nextCursor: rows.length > 50 ? rows[49]!.id : null,
    };
  }
  if (
    cursor &&
    !(await prisma.subscriptionEvent.findFirst({
      where: { id: cursor, merchantId },
      select: { id: true },
    }))
  )
    throw new BadRequestException('Invalid history cursor.');
  const rows = await prisma.subscriptionEvent.findMany({
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
