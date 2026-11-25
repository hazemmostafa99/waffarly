import type {
  ActivityFeatureSettings,
  BusinessActivitySettings,
  OwnerProfile,
} from '@waffarly/contracts';

export interface MerchantOutletContext {
  profile: OwnerProfile;
  activitySettings: BusinessActivitySettings;
  /** Feature switches Super Admin set for this merchant's activity (from the owner session). */
  activityFeatures: ActivityFeatureSettings;
  search: string;
  updateProfile: (changes: Partial<OwnerProfile>) => void;
}
