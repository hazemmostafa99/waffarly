export type BusinessActivityKey = 'restaurant';
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
