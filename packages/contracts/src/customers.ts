/** First contact and order channel are separate facts. */
export const CUSTOMER_CHANNELS = ['marketplace', 'storefront', 'pos', 'manual'] as const;
export type CustomerChannel = (typeof CUSTOMER_CHANNELS)[number];

/** Merchant-owned contact data; never a global account/profile projection. */
export interface MerchantCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string;
  segment: 'regular' | 'vip';
  firstChannel: CustomerChannel;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMerchantCustomerRequest {
  /** Client-generated UUID; retries with the same content replay safely. */
  requestId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string;
  segment?: 'regular' | 'vip';
}

export interface UpdateMerchantCustomerRequest {
  revision: number;
  name?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string;
  segment?: 'regular' | 'vip';
  archived?: boolean;
}

export interface LinkOrderCustomerRequest {
  revision: number;
  customerId: string;
}
export interface OrderCustomerLink {
  orderId: string;
  customerId: string;
  revision: number;
}

export interface OrderCustomerContext {
  orderId: string;
  customerId: string | null;
  revision: number;
}

export interface CustomerOrderSummary {
  id: string;
  reference: string | null;
  source: string;
  status: string;
  total: string;
  currency: 'EGP';
  createdAt: string;
}
