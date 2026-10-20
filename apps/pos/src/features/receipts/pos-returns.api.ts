import type {
  PosOrderReturnsState,
  RecordPosItemReturnRequest,
  RecordPosItemReturnResponse,
} from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posOrderReturnsKey = (merchantId: string, orderId: string) =>
  ['pos', 'returns', merchantId, orderId] as const;

export function getPosOrderReturns(
  orderId: string,
  signal: AbortSignal,
): Promise<PosOrderReturnsState> {
  return apiRequest(`/pos/orders/${orderId}/returns`, { method: 'GET', signal });
}

export function recordPosItemReturn(
  orderId: string,
  request: RecordPosItemReturnRequest,
): Promise<RecordPosItemReturnResponse> {
  return apiRequest(`/pos/orders/${orderId}/returns`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
