import type { ProductInventoryMode } from './catalog.js';

export const BUSINESS_ACTIVITY_KEYS = [
  'restaurant',
  'clothing',
  'supermarket',
  'home_goods',
  'electrical',
  'other',
] as const;
export type BusinessActivityKey = (typeof BUSINESS_ACTIVITY_KEYS)[number];

export const BUSINESS_ACTIVITY_LABELS: Record<BusinessActivityKey, string> = {
  restaurant: 'Restaurants',
  clothing: 'Clothing stores',
  supermarket: 'Supermarkets',
  home_goods: 'Home goods stores',
  electrical: 'Electrical stores',
  other: 'Other business',
};

export interface BusinessActivitySettings {
  /** Initial choice for a new product, not a restriction on which mode a merchant may select. */
  defaultInventoryMode: ProductInventoryMode;
}

/** Fixed per-activity defaults that Super Admin does not edit. */
export const BUSINESS_ACTIVITY_SETTINGS: Record<BusinessActivityKey, BusinessActivitySettings> = {
  restaurant: { defaultInventoryMode: 'RECIPE' },
  clothing: { defaultInventoryMode: 'DIRECT' },
  supermarket: { defaultInventoryMode: 'DIRECT' },
  home_goods: { defaultInventoryMode: 'DIRECT' },
  electrical: { defaultInventoryMode: 'DIRECT' },
  other: { defaultInventoryMode: 'DIRECT' },
};

/**
 * Features Super Admin switches on or off per activity.
 * - kitchen: kitchen screen, kitchen tickets, preparation steps and the Kitchen employee role.
 * - diningTables: POS tables and dine-in orders.
 * - delivery: POS delivery sales, courier assignment and delivery follow-up.
 */
export const ACTIVITY_FEATURES = ['kitchen', 'diningTables', 'delivery'] as const;
export type ActivityFeature = (typeof ACTIVITY_FEATURES)[number];
export type ActivityFeatureSettings = Record<ActivityFeature, boolean>;

/**
 * Features an activity may use at all. Super Admin can switch an available feature
 * off, but never switch an unavailable one on: kitchen and tables exist only for restaurants.
 */
export const ACTIVITY_FEATURE_AVAILABILITY: Record<BusinessActivityKey, ActivityFeatureSettings> = {
  restaurant: { kitchen: true, diningTables: true, delivery: true },
  clothing: { kitchen: false, diningTables: false, delivery: true },
  supermarket: { kitchen: false, diningTables: false, delivery: true },
  home_goods: { kitchen: false, diningTables: false, delivery: true },
  electrical: { kitchen: false, diningTables: false, delivery: true },
  other: { kitchen: false, diningTables: false, delivery: true },
};

/** Availability for a stored key; a missing or unknown key gets the `other` rules. */
export function activityFeatureAvailability(
  activity: string | null | undefined,
): ActivityFeatureSettings {
  return BUSINESS_ACTIVITY_KEYS.includes(activity as BusinessActivityKey)
    ? ACTIVITY_FEATURE_AVAILABILITY[activity as BusinessActivityKey]
    : ACTIVITY_FEATURE_AVAILABILITY.other;
}

/**
 * The features a merchant may use: Super Admin's saved switches, limited to what the
 * activity allows. Before Super Admin saves anything (`saved` is null), every available
 * feature is on. Example: clothing saved { kitchen: true, ... } still resolves kitchen to false.
 */
export function resolveActivityFeatures(
  activity: string | null | undefined,
  saved: ActivityFeatureSettings | null,
): ActivityFeatureSettings {
  const available = activityFeatureAvailability(activity);
  return {
    kitchen: available.kitchen && (saved?.kitchen ?? true),
    diningTables: available.diningTables && (saved?.diningTables ?? true),
    delivery: available.delivery && (saved?.delivery ?? true),
  };
}

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
  /** Effective feature switches for merchants of this activity. */
  features: ActivityFeatureSettings;
  /** Which switches Super Admin may turn on for this activity. */
  availableFeatures: ActivityFeatureSettings;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UpdateBusinessActivityRequest {
  name: string;
  description: string;
  features: ActivityFeatureSettings;
  revision: number;
}

/**
 * Feature switches for a signed-in owner or employee. The API always sends
 * `activityFeatures`; an actor without it falls back to its activity's defaults.
 */
export function actorActivityFeatures(actor: {
  activity?: string | null | undefined;
  activityFeatures?: ActivityFeatureSettings | undefined;
}): ActivityFeatureSettings {
  return actor.activityFeatures ?? resolveActivityFeatures(actor.activity, null);
}
