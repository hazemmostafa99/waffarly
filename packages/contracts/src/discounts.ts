export type MerchantDiscountType = 'percentage' | 'fixed';
export type MerchantDiscountState = 'published' | 'draft' | 'paused';
export type MerchantDiscountStatus = 'active' | 'scheduled' | 'draft' | 'paused' | 'expired';

export interface MerchantDiscountInput {
  name: string;
  description: string;
  code: string;
  type: MerchantDiscountType;
  /** Percentage or EGP decimal string, up to two fractional digits. */
  value: string;
  minimum: string;
  /** Empty means uncapped. Fixed discounts do not use a separate cap. */
  maximum: string;
  /** Inclusive calendar dates in Africa/Cairo. */
  startDate: string;
  endDate: string;
  /** Empty means unlimited. */
  usageLimit: string;
  /** Empty means all branches. Public checkout supports all-branch coupons only. */
  branches: string[];
  terms: string;
  state: MerchantDiscountState;
}

export interface MerchantDiscount extends MerchantDiscountInput {
  id: string;
  revision: number;
  status: MerchantDiscountStatus;
  redemptions: number;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantDiscountStats {
  totalDiscountValue: string;
  activeCoupons: number;
  customersReached: number;
  totalRedemptions: number;
  totalCoupons: number;
}

export interface OrderDiscountSnapshot {
  code: string;
  name: string;
  type: MerchantDiscountType;
  value: string;
  amount: string;
  terms: string;
}
