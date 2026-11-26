import type { BusinessActivityKey } from './activities.js';

export interface MerchantSummary {
  storefrontHandle: string;
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
  storefrontHandle: string;
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
  /** Requested subdomain; also the first part of every POS cashier sign-in name. */
  storefrontHandle: string;
  name: string;
  activity?: BusinessActivityKey;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
}

export interface MerchantApplicationSummary
  extends Omit<SubmitMerchantApplicationRequest, 'storefrontHandle'> {
  /** Null for applications sent before the subdomain became required. */
  storefrontHandle: string | null;
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

export interface RejectedMerchantApplicationSummary
  extends Omit<SubmitMerchantApplicationRequest, 'storefrontHandle'> {
  storefrontHandle: string | null;
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
  /** Confirms or replaces the subdomain the applicant asked for. */
  storefrontHandle: string;
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
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  firstMonthActivatedAt: string | null;
}
