export const BUSINESS_ACTIVITY_KEYS = ['restaurant', 'clothing', 'supermarket', 'other'] as const;
export type BusinessActivityKey = (typeof BUSINESS_ACTIVITY_KEYS)[number];

export const BUSINESS_ACTIVITY_LABELS: Record<BusinessActivityKey, string> = {
  restaurant: 'Restaurants',
  clothing: 'Clothing stores',
  supermarket: 'Supermarkets',
  other: 'Other business',
};

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
