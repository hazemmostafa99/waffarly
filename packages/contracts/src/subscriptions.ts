import type { SubscriptionMonths } from './plans.js';

export type SubscriptionStatus =
  'pending' | 'active' | 'suspended' | 'cancelled' | 'expired' | 'legacy';
export interface SubscriptionPeriodSummary {
  id: string;
  planId: string;
  planName: string;
  months: SubscriptionMonths;
  price: string;
  collected: string;
  credit: string;
  startsAt: string;
  endsAt: string;
  coverageEndsAt: string;
}
export interface SubscriptionEventSummary {
  id: string;
  action: string;
  administrator: string;
  reason: string;
  createdAt: string;
  collected: string;
}
export interface SubscriptionSummary {
  merchantId: string;
  merchantName: string;
  status: SubscriptionStatus;
  revision: number;
  cancelAtEnd: boolean;
  endsAt: string | null;
  assignedPlanId: string | null;
  assignedMonths: SubscriptionMonths | null;
  currentPeriod: SubscriptionPeriodSummary | null;
}
export interface SubscriptionDetail extends SubscriptionSummary {
  periods: SubscriptionPeriodSummary[];
  events: SubscriptionEventSummary[];
  nextPeriodCursor: string | null;
  nextEventCursor: string | null;
}
export interface SubscriptionCommand {
  requestId: string;
  revision: number;
  reason: string;
  action:
    | 'assign'
    | 'activate'
    | 'renew'
    | 'change'
    | 'suspend'
    | 'resume'
    | 'cancel'
    | 'cancel-at-end'
    | 'keep-active';
  planId?: string | undefined;
  months?: SubscriptionMonths | undefined;
  planRevision?: number | undefined;
  externalCollectionConfirmed?: true | undefined;
  expectedDue?: string | undefined;
  /** Immediate-change quotes have a short, server-checked lifetime. */
  effectiveAt?: string | undefined;
}
export interface SubscriptionQuote {
  action: 'activate' | 'renew' | 'change';
  subscriptionRevision: number;
  planId: string;
  planName: string;
  planRevision: number;
  months: SubscriptionMonths;
  price: string;
  credit: string;
  due: string;
  startsAt: string;
  endsAt: string;
}
export interface SubscriptionDashboard {
  counts: Record<SubscriptionStatus, number>;
  expiringSoon: number;
  collected: string;
}
