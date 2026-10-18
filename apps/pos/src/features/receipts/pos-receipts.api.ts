import type { PosReceipt, PosReceiptHistoryPage } from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posCheckReceiptKey = (merchantId: string, orderId: string, checkId: string) =>
  ['pos', 'receipts', merchantId, orderId, checkId] as const;

export const posReceiptHistoryKey = (merchantId: string, branchId: string) =>
  ['pos', 'receipts', merchantId, branchId] as const;

export function getPosCheckReceipt(
  orderId: string,
  checkId: string,
  signal: AbortSignal,
): Promise<PosReceipt> {
  return apiRequest(`/pos/orders/${orderId}/checks/${checkId}/receipt`, {
    method: 'GET',
    signal,
  });
}

export function listPosReceipts(
  branchId: string,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<PosReceiptHistoryPage> {
  const query = new URLSearchParams({ branchId, limit: '25' });
  if (cursor) query.set('cursor', cursor);
  return apiRequest(`/pos/receipts?${query.toString()}`, { method: 'GET', signal });
}
