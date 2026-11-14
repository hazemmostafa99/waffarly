/** Prepares merchant and application summaries for the administrator. */
import type {
  BusinessActivityKey,
  MerchantApplicationSummary,
  MerchantSummary,
  RejectedMerchantApplicationSummary,
} from '@waffarly/contracts';

import { effectiveSubscriptionStatus } from '../subscriptions/index.js';

export type MerchantWithOwner = {
  id: string;
  name: string;
  storefrontSlug: string;
  storefrontHandle?: string | null;
  activity?: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  firstMonthActivatedAt: Date | null;
  createdAt: Date;
  owner: { username: string } | null;
  subscription?: { status: string; periods: { id: string }[] } | null;
};

export function toMerchantSummary(merchant: MerchantWithOwner): MerchantSummary {
  return {
    id: merchant.id,
    name: merchant.name,
    businessCode: merchant.storefrontSlug,
    storefrontHandle: merchant.storefrontHandle ?? null,
    activity: (merchant.activity ?? 'other') as BusinessActivityKey,
    contactPhone: merchant.contactPhone,
    ownerName: merchant.ownerName,
    ownerMobile: merchant.ownerMobile,
    username: merchant.owner?.username ?? '',
    firstMonthActivatedAt: merchant.firstMonthActivatedAt?.toISOString() ?? null,
    subscriptionStatus: merchant.subscription
      ? effectiveSubscriptionStatus(
          merchant.subscription.status,
          merchant.subscription.periods.length > 0,
        )
      : merchant.firstMonthActivatedAt
        ? 'legacy'
        : 'pending',
    createdAt: merchant.createdAt.toISOString(),
  };
}

export type MerchantApplicationRecord = {
  id: string;
  name: string;
  activity?: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  createdAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  merchantId: string | null;
};

export function toRejectedApplicationSummary(
  application: MerchantApplicationRecord,
): RejectedMerchantApplicationSummary {
  if (!application.rejectedAt || !application.rejectedBy || application.rejectionReason === null) {
    throw new Error('Rejected application is missing rejection metadata.');
  }
  return {
    id: application.id,
    name: application.name,
    activity: (application.activity ?? 'other') as BusinessActivityKey,
    contactPhone: application.contactPhone,
    ownerName: application.ownerName,
    ownerMobile: application.ownerMobile,
    createdAt: application.createdAt.toISOString(),
    approvedAt: application.approvedAt?.toISOString() ?? null,
    approvedBy: application.approvedBy,
    merchantId: application.merchantId,
    rejectedAt: application.rejectedAt.toISOString(),
    rejectedBy: application.rejectedBy,
    rejectionReason: application.rejectionReason,
  };
}

export function toApplicationSummary(
  application: MerchantApplicationRecord,
  priorRejectedApplications: RejectedMerchantApplicationSummary[] = [],
): MerchantApplicationSummary {
  return {
    id: application.id,
    name: application.name,
    activity: (application.activity ?? 'other') as BusinessActivityKey,
    contactPhone: application.contactPhone,
    ownerName: application.ownerName,
    ownerMobile: application.ownerMobile,
    createdAt: application.createdAt.toISOString(),
    approvedAt: application.approvedAt?.toISOString() ?? null,
    approvedBy: application.approvedBy,
    merchantId: application.merchantId,
    rejectedAt: application.rejectedAt?.toISOString() ?? null,
    rejectedBy: application.rejectedBy,
    rejectionReason: application.rejectionReason,
    priorRejectedApplications,
  };
}
