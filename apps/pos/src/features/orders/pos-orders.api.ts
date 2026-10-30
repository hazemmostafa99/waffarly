import type {
  AddPosKitchenItemsRequest,
  AddPosKitchenItemsResponse,
  CancelPosOrderRequest,
  CreatePosOrderRequest,
  CreatePosOrderResponse,
  CursorPage,
  DispatchPosKitchenOrderRequest,
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

export function addPosKitchenItems(
  orderId: string,
  request: AddPosKitchenItemsRequest,
): Promise<AddPosKitchenItemsResponse> {
  return apiRequest(`/pos/orders/${encodeURIComponent(orderId)}/kitchen-amendments`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export const posOrderDetailKey = (merchantId: string, employeeId: string, orderId: string) =>
  ['pos', 'orders', 'detail', merchantId, employeeId, orderId] as const;

export function getPosOrder(orderId: string, signal: AbortSignal): Promise<StorefrontOrderSummary> {
  return apiRequest(`/pos/orders/${encodeURIComponent(orderId)}`, { method: 'GET', signal });
}

export function dispatchPosKitchenOrder(
  orderId: string,
  request: DispatchPosKitchenOrderRequest,
): Promise<StorefrontOrderSummary> {
  return apiRequest(`/pos/orders/${encodeURIComponent(orderId)}/kitchen-dispatch`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function cancelPosOrder(
  orderId: string,
  request: CancelPosOrderRequest,
): Promise<StorefrontOrderSummary> {
  return apiRequest(`/pos/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
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

export function listPosSales(
  branchId: string,
  mode: 'active' | 'history',
  search: string,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<CursorPage<StorefrontOrderSummary>> {
  const params = new URLSearchParams({ branchId, mode, limit: '25' });
  if (search.trim()) params.set('search', search.trim());
  if (cursor) params.set('cursor', cursor);
  return apiRequest(`/pos/orders/active-sales?${params.toString()}`, { method: 'GET', signal });
}

export function runPosOrderAction(
  orderId: string,
  action: PendingPosAction,
): Promise<StorefrontOrderSummary> {
  return apiRequest(
    `/pos/orders/${orderId}/${
      action.action === 'accept'
        ? 'accept'
        : action.action === 'cancel_ack'
          ? 'cancellation-acknowledgement'
          : action.action === 'item_ready'
            ? `items/${encodeURIComponent(action.lineId)}/ready`
            : action.action === 'prepare'
              ? 'start-preparation'
              : action.action === 'ready'
                ? 'ready'
                : 'handover'
    }`,
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
