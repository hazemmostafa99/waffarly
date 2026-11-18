import type { StorefrontOrderReceipt } from '@waffarly/contracts';

const receiptKey = (orderId: string) => `storefront-order-receipt:${orderId}`;
const validOrderStatuses = new Set([
  'pending',
  'accepted',
  'rejected',
  'preparing',
  'ready',
  'completed',
  'cancelled',
]);

export function saveStorefrontOrderReceipt(receipt: StorefrontOrderReceipt): void {
  const safeReceipt: StorefrontOrderReceipt = {
    id: receipt.id,
    status: receipt.status,
    currency: receipt.currency,
    total: receipt.total,
    createdAt: receipt.createdAt,
    ...(receipt.branchName ? { branchName: receipt.branchName } : {}),
  };

  try {
    window.sessionStorage.setItem(receiptKey(receipt.id), JSON.stringify(safeReceipt));
  } catch {
    // Tracking remains available from the confirmation screen if storage is blocked.
  }
}

export function loadStorefrontOrderReceipt(orderId: string): StorefrontOrderReceipt | null {
  try {
    const value = window.sessionStorage.getItem(receiptKey(orderId));
    if (!value) return null;
    const receipt = JSON.parse(value) as Partial<StorefrontOrderReceipt>;
    if (
      receipt.id !== orderId ||
      typeof receipt.status !== 'string' ||
      receipt.currency !== 'EGP' ||
      typeof receipt.total !== 'string' ||
      typeof receipt.createdAt !== 'string' ||
      Number.isNaN(Date.parse(receipt.createdAt)) ||
      !validOrderStatuses.has(receipt.status)
    ) {
      return null;
    }
    return receipt as StorefrontOrderReceipt;
  } catch {
    return null;
  }
}
