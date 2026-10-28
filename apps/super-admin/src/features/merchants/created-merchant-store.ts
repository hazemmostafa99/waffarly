import { create } from 'zustand';
import type { MerchantSummary } from '@waffarly/contracts';

export interface CreatedMerchantResult {
  merchant: MerchantSummary;
  password: string;
}

interface CreatedMerchantState {
  result: CreatedMerchantResult | null;
  setResult: (result: CreatedMerchantResult | null) => void;
}

// Memory only: credentials must not be placed in URL, browser history, or storage.
export const useCreatedMerchantStore = create<CreatedMerchantState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
