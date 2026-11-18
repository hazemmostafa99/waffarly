import type { BusinessActivitySummary } from '@waffarly/contracts';
import { BUSINESS_ACTIVITY_KEYS, BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';

export const activityDefinitions: readonly BusinessActivitySummary[] = BUSINESS_ACTIVITY_KEYS.map(
  (key) => ({
    key,
    name: BUSINESS_ACTIVITY_LABELS[key],
    description: 'Business profile and storefront branding for this activity.',
    revision: 0,
    updatedAt: null,
    updatedBy: null,
  }),
);
