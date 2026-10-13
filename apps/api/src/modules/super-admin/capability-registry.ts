import type { BusinessActivitySummary, PlatformModuleDefinition } from '@waffarly/contracts';

// Add capabilities here only alongside working application functionality and a migration
// that extends the database key constraints. Metadata never deploys software.
export const activityDefinitions: readonly BusinessActivitySummary[] = [
  {
    key: 'restaurant',
    name: 'Restaurants',
    description: 'Restaurant merchants are the first supported business activity.',
    moduleKeys: ['merchant-profile', 'storefront-design'],
    revision: 0,
    updatedAt: null,
    updatedBy: null,
  },
];

export const moduleDefinitions: readonly PlatformModuleDefinition[] = [
  {
    key: 'merchant-profile',
    name: 'Merchant profile',
    description: 'An activated owner can view the restaurant and owner contact profile.',
    supportedActivities: ['restaurant'],
    dependencies: [],
  },
  {
    key: 'storefront-design',
    name: 'Storefront design & branding',
    description:
      'An activated owner can select a restaurant design, add a logo, and set an accent color.',
    supportedActivities: ['restaurant'],
    dependencies: [],
  },
];
