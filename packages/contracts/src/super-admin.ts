import type { BusinessActivityKey } from './activities-modules.js';

export interface MerchantSummary {
  id: string;
  name: string;
  activity?: BusinessActivityKey;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  username: string;
  firstMonthActivatedAt: string | null;
  createdAt: string;
}

export interface CreateMerchantRequest {
  name: string;
  activity?: BusinessActivityKey;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  username: string;
  password: string;
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
  username: string;
  merchantId: string;
  merchantName: string;
  activity?: BusinessActivityKey;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  firstMonthActivatedAt: string;
}
