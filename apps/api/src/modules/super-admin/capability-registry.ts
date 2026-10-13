import { BUSINESS_ACTIVITY_KEYS, BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';
import type { BusinessActivitySummary, PlatformModuleDefinition } from '@waffarly/contracts';

// Add capabilities here only alongside working application functionality and a migration
// that extends the database key constraints. Metadata never deploys software.
export const activityDefinitions: readonly BusinessActivitySummary[] = BUSINESS_ACTIVITY_KEYS.map(
  (key) => ({
    key,
    name: BUSINESS_ACTIVITY_LABELS[key],
    description: 'Business profile and storefront branding for this activity.',
    moduleKeys: ['merchant-profile', 'storefront-design'],
    revision: 0,
    updatedAt: null,
    updatedBy: null,
  }),
);

export const moduleDefinitions: readonly PlatformModuleDefinition[] = [
  {
    key: 'merchant-profile',
    name: 'Merchant profile',
    description: 'An activated owner can view the business and owner contact profile.',
    supportedActivities: [...BUSINESS_ACTIVITY_KEYS],
    dependencies: [],
  },
  {
    key: 'storefront-design',
    name: 'Storefront design & branding',
    description:
      'An activated owner can select a business design, add a logo, and set an accent color.',
    supportedActivities: [...BUSINESS_ACTIVITY_KEYS],
    dependencies: [],
  },
];
