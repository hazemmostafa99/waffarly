import type { StateCreator } from 'zustand/vanilla';
import type { MarketplaceState } from '@/features/marketplace/state/marketplace-state';

export interface AccountSlice {
  isDemoAccountActive: boolean;
  enterDemoAccount: () => void;
  leaveDemoAccount: () => void;
}

export const createAccountSlice: StateCreator<MarketplaceState, [], [], AccountSlice> = (set) => ({
  isDemoAccountActive: false,
  enterDemoAccount: () => set({ isDemoAccountActive: true }),
  leaveDemoAccount: () => set({ isDemoAccountActive: false }),
});
