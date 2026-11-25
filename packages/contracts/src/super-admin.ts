import type { BusinessActivityKey } from './activities.js';

export interface MerchantSummary {
  storefrontHandle?: string | null;
  subscriptionStatus?: import('./subscriptions.js').SubscriptionStatus;
  id: string;
  name: string;
  businessCode: string;
  activity?: BusinessActivityKey;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  username: string;
  firstMonthActivatedAt: string | null;
  createdAt: string;
}

export interface CreateMerchantRequest {
  storefrontHandle?: string | undefined;
  subscription?: { planId: string; months: import('./plans.js').SubscriptionMonths } | undefined;
  name: string;
  activity?: BusinessActivityKey;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  username: string;
  password: string;
}

/** The merchant is selected by the admin route; password confirmation stays in the UI. */
export interface ResetMerchantOwnerPasswordRequest {
  password: string;
}

/** A successful reset acknowledgement never returns the password or its hash. */
export interface ResetMerchantOwnerPasswordResponse {
  merchantId: string;
  username: string;
  passwordResetAt: string;
}

export interface SubmitMerchantApplicationRequest {
  name: string;
  activity?: BusinessActivityKey;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
}

export interface MerchantApplicationSummary extends SubmitMerchantApplicationRequest {
  id: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  merchantId: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  priorRejectedApplications: RejectedMerchantApplicationSummary[];
}

export interface RejectedMerchantApplicationSummary extends SubmitMerchantApplicationRequest {
  id: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  merchantId: string | null;
  rejectedAt: string;
  rejectedBy: string;
  rejectionReason: string;
}

export interface ApproveMerchantApplicationRequest {
  username: string;
  password: string;
}

export interface RejectMerchantApplicationRequest {
  reason: string;
}

export interface ActivateFirstMonthRequest {
  externalCollectionConfirmed: true;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface OwnerProfile {
  subscriptionStatus?: import('./subscriptions.js').SubscriptionStatus;
  username: string;
  merchantId: string;
  merchantName: string;
  activity?: BusinessActivityKey;
  /** Effective activity feature switches; returned by the API with every owner session. */
  activityFeatures?: import('./activities.js').ActivityFeatureSettings;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  firstMonthActivatedAt: string | null;
}
