export const BUSINESS_ACTIVITY_KEYS = ['restaurant', 'clothing', 'supermarket', 'other'] as const;
export type BusinessActivityKey = (typeof BUSINESS_ACTIVITY_KEYS)[number];
export const BUSINESS_ACTIVITY_LABELS: Record<BusinessActivityKey, string> = {
  restaurant: 'Restaurants',
  clothing: 'Clothing stores',
  supermarket: 'Supermarkets',
  other: 'Other business',
};
export type PlatformModuleKey = 'merchant-profile' | 'storefront-design';

export interface PlatformModuleDefinition {
  key: PlatformModuleKey;
  name: string;
  description: string;
  supportedActivities: BusinessActivityKey[];
  dependencies: PlatformModuleKey[];
}

export interface BusinessActivitySummary {
  key: BusinessActivityKey;
  name: string;
  description: string;
  moduleKeys: PlatformModuleKey[];
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PlatformModuleSummary extends PlatformModuleDefinition {
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ActivitiesModulesCatalog {
  activities: BusinessActivitySummary[];
  modules: PlatformModuleSummary[];
}

export interface UpdateBusinessActivityRequest {
  name: string;
  description: string;
  moduleKeys: PlatformModuleKey[];
  revision: number;
}

export interface UpdatePlatformModuleRequest {
  name: string;
  description: string;
  revision: number;
}
