import type { BusinessActivitySettings, OwnerProfile } from '@waffarly/contracts';

export interface MerchantOutletContext {
  profile: OwnerProfile;
  activitySettings: BusinessActivitySettings;
  search: string;
  updateProfile: (changes: Partial<OwnerProfile>) => void;
}
