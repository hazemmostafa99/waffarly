import type { OwnerProfile } from '@waffarly/contracts';

export interface MerchantOutletContext {
  profile: OwnerProfile;
  search: string;
  updateProfile: (changes: Partial<OwnerProfile>) => void;
}
