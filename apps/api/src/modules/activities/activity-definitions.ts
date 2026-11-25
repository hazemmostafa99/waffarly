import type { BusinessActivitySummary } from '@waffarly/contracts';
import {
  ACTIVITY_FEATURE_AVAILABILITY,
  BUSINESS_ACTIVITY_KEYS,
  BUSINESS_ACTIVITY_LABELS,
} from '@waffarly/contracts';

/** Code defaults for every activity before Super Admin saves it; every available feature starts on. */
export const activityDefinitions: readonly BusinessActivitySummary[] = BUSINESS_ACTIVITY_KEYS.map(
  (key) => ({
    key,
    name: BUSINESS_ACTIVITY_LABELS[key],
    description: 'Business profile and storefront branding for this activity.',
    features: ACTIVITY_FEATURE_AVAILABILITY[key],
    availableFeatures: ACTIVITY_FEATURE_AVAILABILITY[key],
    revision: 0,
    updatedAt: null,
    updatedBy: null,
  }),
);
