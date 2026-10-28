import type { MerchantSummary, SubscriptionStatus } from '@waffarly/contracts';
export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  active: 'Active subscription',
  pending: 'Awaiting activation',
  suspended: 'Suspended subscription',
  expired: 'Expired subscription',
  cancelled: 'Cancelled subscription',
  legacy: 'Needs subscription review',
};
export function merchantSubscriptionStatus(merchant: MerchantSummary): SubscriptionStatus {
  return merchant.subscriptionStatus ?? (merchant.firstMonthActivatedAt ? 'legacy' : 'pending');
}
export function merchantHasAccess(merchant: MerchantSummary) {
  return ['active', 'legacy'].includes(merchantSubscriptionStatus(merchant));
}
