import type { CatalogProductQuoteRequest, CatalogProductQuoteResponse } from './catalog.js';
import type { StorefrontOrderSummary } from './catalog.js';

export interface PosOrderQuoteRequest {
  items: Array<{
    lineId: string;
    productId: string;
    variantId?: string | undefined;
    selections: NonNullable<CatalogProductQuoteRequest['selections']>;
    quantity: number;
  }>;
}

export interface PosOrderQuoteResponse {
  currency: 'EGP';
  subtotal: string;
  total: string;
  items: Array<{
    lineId: string;
    quantity: number;
    lineTotal: string;
    quote: CatalogProductQuoteResponse;
  }>;
}

export interface CreatePosOrderRequest {
  requestId: string;
  registerId: string;
  fulfillmentType: 'dine_in' | 'takeaway' | 'delivery';
  tableId?: string | undefined;
  customerName?: string | undefined;
  customerPhone?: string | undefined;
  deliveryAddress?: string | undefined;
  items: Array<{
    lineId: string;
    productId: string;
    variantId?: string | undefined;
    selections: NonNullable<CatalogProductQuoteRequest['selections']>;
    quantity: number;
    expectedProductRevision: number;
    note?: string | undefined;
  }>;
}

export type CreatePosOrderResponse = StorefrontOrderSummary;
