import type {
  PosOrderPaymentStateResponse,
  RecordPosCheckPaymentRequest,
  RecordPosCheckPaymentResponse,
} from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posPaymentStateKey = (merchantId: string, orderId: string) =>
  ['pos', 'payments', merchantId, orderId] as const;

export function getPosOrderPaymentState(
  orderId: string,
  signal: AbortSignal,
): Promise<PosOrderPaymentStateResponse> {
  return apiRequest(`/pos/orders/${orderId}/payment-state`, { method: 'GET', signal });
}

export function recordPosCheckPayment(
  orderId: string,
  checkId: string,
  input: RecordPosCheckPaymentRequest,
): Promise<RecordPosCheckPaymentResponse> {
  return apiRequest(`/pos/orders/${orderId}/checks/${checkId}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
