import type { SubscriptionCommand, SubscriptionDetail } from '@waffarly/contracts';

export const subscriptionActions: Record<SubscriptionCommand['action'], string> = {
  assign: 'Assign plan',
  activate: 'Activate subscription',
  renew: 'Renew subscription',
  change: 'Change plan now',
  suspend: 'Suspend subscription',
  resume: 'Resume subscription',
  cancel: 'Cancel immediately',
  'cancel-at-end': 'Cancel at period end',
  'keep-active': 'Restore renewal',
};

export function availableSubscriptionActions(
  s: SubscriptionDetail,
): SubscriptionCommand['action'][] {
  if (s.status === 'suspended') return ['resume', 'cancel'];
  if (s.status === 'pending') return ['activate', 'assign', 'cancel'];
  if (s.status === 'legacy') return ['activate', 'assign', 'suspend', 'cancel'];
  if (s.status === 'cancelled') return ['activate'];
  if (s.status === 'expired') return [s.cancelAtEnd ? 'keep-active' : 'renew', 'cancel'];
  return [
    ...(s.cancelAtEnd
      ? ['keep-active' as const]
      : ['renew' as const, 'change' as const, 'cancel-at-end' as const]),
    'suspend',
    'cancel',
  ];
}
