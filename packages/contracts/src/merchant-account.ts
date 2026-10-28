import type { BusinessActivityKey } from './activities-modules.js';
import type { CursorPage } from './pagination.js';
import type { SubscriptionMonths } from './plans.js';
import type { SubscriptionPeriodSummary, SubscriptionStatus } from './subscriptions.js';

export interface MerchantAccountProfile {
  merchantId: string;
  merchantName: string;
  activity: BusinessActivityKey;
  username: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  storefrontSlug: string;
  logoData: string | null;
  createdAt: string;
  revision: number;
  updatedAt: string | null;
}

export interface UpdateMerchantAccountRequest {
  merchantName: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  revision: number;
}

/** Merchant-visible billing facts; excludes administrator identities and internal notes. */
export interface OwnerSubscriptionOverview {
  status: SubscriptionStatus;
  currency: 'EGP';
  cancelAtEnd: boolean;
  assignedPlanName: string | null;
  assignedMonths: SubscriptionMonths | null;
  currentPeriod: SubscriptionPeriodSummary | null;
  nextPeriod: SubscriptionPeriodSummary | null;
  latestPeriod: SubscriptionPeriodSummary | null;
  coverageEndsAt: string | null;
  asOf: string;
}

export interface MerchantAccountOverview {
  profile: MerchantAccountProfile;
  subscription: OwnerSubscriptionOverview;
}

export type OwnerSubscriptionHistory = CursorPage<SubscriptionPeriodSummary>;
