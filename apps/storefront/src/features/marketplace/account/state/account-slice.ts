import type { StateCreator } from 'zustand/vanilla';
import type { DemoAddressId } from '@/features/marketplace/account/model/demo-addresses';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export interface AccountSlice {
  isDemoAccountActive: boolean;
  selectedDemoAddressId: DemoAddressId;
  enterDemoAccount: () => void;
  leaveDemoAccount: () => void;
  selectDemoAddress: (addressId: DemoAddressId) => void;
}

export const createAccountSlice: StateCreator<MarketplaceState, [], [], AccountSlice> = (set) => ({
  isDemoAccountActive: false,
  selectedDemoAddressId: 'sample-address-one',
  enterDemoAccount: () => set({ isDemoAccountActive: true }),
  leaveDemoAccount: () => set({ isDemoAccountActive: false }),
  selectDemoAddress: (selectedDemoAddressId) => set({ selectedDemoAddressId }),
});
