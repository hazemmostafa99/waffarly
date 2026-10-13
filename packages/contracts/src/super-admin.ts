export interface MerchantSummary {
  id: string;
  name: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  username: string;
  firstMonthActivatedAt: string | null;
  createdAt: string;
}

export interface CreateMerchantRequest {
  name: string;
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  username: string;
  password: string;
}

export interface SubmitMerchantApplicationRequest {
  name: string;
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
}

export interface ApproveMerchantApplicationRequest {
  username: string;
  password: string;
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
  contactPhone: string;
  ownerName: string;
  ownerMobile: string;
  firstMonthActivatedAt: string;
}
