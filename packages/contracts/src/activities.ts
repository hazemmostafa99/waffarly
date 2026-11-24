import type { ProductInventoryMode } from './catalog.js';

export const BUSINESS_ACTIVITY_KEYS = ['restaurant', 'clothing', 'supermarket', 'other'] as const;
export type BusinessActivityKey = (typeof BUSINESS_ACTIVITY_KEYS)[number];

export const BUSINESS_ACTIVITY_LABELS: Record<BusinessActivityKey, string> = {
  restaurant: 'Restaurants',
  clothing: 'Clothing stores',
  supermarket: 'Supermarkets',
  other: 'Other business',
};

export interface BusinessActivitySettings {
  /** Initial choice for a new product, not a restriction on which mode a merchant may select. */
  defaultInventoryMode: ProductInventoryMode;
  hasKitchen: boolean;
  hasDiningTables: boolean;
}

/** Target activity behavior for upcoming merchant and POS tasks; the UI does not yet use these settings. */
export const BUSINESS_ACTIVITY_SETTINGS: Record<BusinessActivityKey, BusinessActivitySettings> = {
  restaurant: { defaultInventoryMode: 'RECIPE', hasKitchen: true, hasDiningTables: true },
  clothing: { defaultInventoryMode: 'DIRECT', hasKitchen: false, hasDiningTables: false },
  supermarket: { defaultInventoryMode: 'DIRECT', hasKitchen: false, hasDiningTables: false },
  other: { defaultInventoryMode: 'DIRECT', hasKitchen: false, hasDiningTables: false },
};

/** Return safe retail defaults for a missing or unknown stored activity key. */
export function resolveBusinessActivitySettings(
  activity: string | null | undefined,
): BusinessActivitySettings {
  if (!BUSINESS_ACTIVITY_KEYS.includes(activity as BusinessActivityKey)) {
    return BUSINESS_ACTIVITY_SETTINGS.other;
  }
  return BUSINESS_ACTIVITY_SETTINGS[activity as BusinessActivityKey];
}

export interface BusinessActivitySummary {
  key: BusinessActivityKey;
  name: string;
  description: string;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UpdateBusinessActivityRequest {
  name: string;
  description: string;
  revision: number;
}
