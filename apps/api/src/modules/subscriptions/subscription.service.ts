/** Routes subscription requests to access checks, pricing, account reads and administrative actions. */
import { Inject, Injectable } from '@nestjs/common';

import type {
  SubscriptionCommand,
  SubscriptionDetail,
  SubscriptionQuote,
  SubscriptionStatus,
  SubscriptionDashboard,
  SubscriptionMonths,
  OwnerSubscriptionOverview,
  CursorPage,
  SubscriptionPeriodSummary,
  SubscriptionEventSummary,
} from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

import { type SubscriptionClient } from './subscription-record.mapper.js';
import {
  ownerOverview,
  listSubscriptions,
  dashboard,
  getSubscriptionDetails,
  listSubscriptionHistory,
} from './queries/subscription-queries.js';
import { assignOnboarding } from './onboarding/assign-subscription.js';
import { readSubscriptionAccess, requireActive } from './access/subscription-access.js';

import { quoteSubscriptionChange } from './pricing/quote-subscription.js';
import { applySubscriptionCommand } from './commands/apply-subscription-command.js';

@Injectable()
export class SubscriptionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ownerOverview(
    merchantId: string,
    client: SubscriptionClient = this.prisma,
  ): Promise<OwnerSubscriptionOverview> {
    return ownerOverview(this.prisma, merchantId, client);
  }

  async assignOnboarding(
    tx: SubscriptionClient,
    merchantId: string,
    input: { planId: string; months: SubscriptionMonths },
    administrator: string,
  ) {
    return assignOnboarding(this.prisma, tx, merchantId, input, administrator);
  }

  async access(merchantId: string): Promise<{ allowed: boolean; status: SubscriptionStatus }> {
    return readSubscriptionAccess(this.prisma, merchantId);
  }

  async requireActive(merchantId: string, tx?: SubscriptionClient) {
    return requireActive(this.prisma, merchantId, tx);
  }

  async list(query: {
    cursor?: string | undefined;
    status?: SubscriptionStatus | undefined;
    q?: string | undefined;
    expiring?: boolean | undefined;
    planId?: string | undefined;
  }) {
    return listSubscriptions(this.prisma, query);
  }

  async dashboard(): Promise<SubscriptionDashboard> {
    return dashboard(this.prisma);
  }

  async detail(
    merchantId: string,
    client: SubscriptionClient = this.prisma,
  ): Promise<SubscriptionDetail> {
    return getSubscriptionDetails(this.prisma, merchantId, client);
  }

  async history(
    merchantId: string,
    kind: 'periods',
    cursor?: string,
  ): Promise<CursorPage<SubscriptionPeriodSummary>>;
  async history(
    merchantId: string,
    kind: 'events',
    cursor?: string,
  ): Promise<CursorPage<SubscriptionEventSummary>>;
  async history(
    merchantId: string,
    kind: 'periods' | 'events',
    cursor?: string,
  ): Promise<CursorPage<SubscriptionPeriodSummary> | CursorPage<SubscriptionEventSummary>>;
  async history(merchantId: string, kind: 'periods' | 'events', cursor?: string) {
    return listSubscriptionHistory(this.prisma, merchantId, kind, cursor);
  }

  async quote(
    merchantId: string,
    input: {
      action: 'activate' | 'renew' | 'change';
      planId: string;
      months: SubscriptionMonths;
      effectiveAt?: string | undefined;
    },
    client: SubscriptionClient = this.prisma,
  ): Promise<SubscriptionQuote> {
    return quoteSubscriptionChange(this.prisma, merchantId, input, client);
  }

  async command(
    merchantId: string,
    input: SubscriptionCommand,
    administrator: string,
  ): Promise<SubscriptionDetail> {
    return applySubscriptionCommand(this.prisma, merchantId, input, administrator);
  }
}
