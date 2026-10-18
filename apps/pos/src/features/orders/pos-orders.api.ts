import type {
  CreatePosOrderRequest,
  CreatePosOrderResponse,
  CursorPage,
  PosOrderQuoteRequest,
  PosOrderQuoteResponse,
  StorefrontOrderSummary,
} from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';
import type { PendingPosAction } from '../../app/pos-workspace-store.js';

export const posOrderKeys = {
  all: ['pos', 'orders'] as const,
  branch: (merchantId: string, branchId: string) =>
    [...posOrderKeys.all, merchantId, branchId] as const,
  quote: (merchantId: string, request: PosOrderQuoteRequest) =>
    ['pos', 'quote', merchantId, request] as const,
};

export function quotePosOrder(request: PosOrderQuoteRequest): Promise<PosOrderQuoteResponse> {
  return apiRequest('/pos/orders/quote', { method: 'POST', body: JSON.stringify(request) });
}

export function createPosOrder(request: CreatePosOrderRequest): Promise<CreatePosOrderResponse> {
  return apiRequest('/pos/orders', { method: 'POST', body: JSON.stringify(request) });
}

export function listPosOrders(
  branchId: string,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<CursorPage<StorefrontOrderSummary>> {
  const params = new URLSearchParams({ branchId, limit: '25' });
  if (cursor) params.set('cursor', cursor);
  return apiRequest(`/pos/orders?${params.toString()}`, { method: 'GET', signal });
}

export function runPosOrderAction(
  orderId: string,
  action: PendingPosAction,
): Promise<StorefrontOrderSummary> {
  return apiRequest(
    `/pos/orders/${orderId}/${action.action === 'accept' ? 'accept' : 'start-preparation'}`,
    {
      method: 'POST',
      body: JSON.stringify(
        action.action === 'accept'
          ? { requestId: action.requestId, branchId: action.branchId }
          : { requestId: action.requestId },
      ),
    },
  );
}
