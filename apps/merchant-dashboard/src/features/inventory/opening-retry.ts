import type { CreateStockOpeningRequest } from '@waffarly/contracts';
const openingRequestKey = 'waffarly-opening-stock-request';
const pendingOpeningKey = 'waffarly-opening-stock-pending';

export function loadPendingOpening(): CreateStockOpeningRequest | null {
  try {
    const value = sessionStorage.getItem(pendingOpeningKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('requestId' in parsed) ||
      typeof parsed.requestId !== 'string' ||
      !('reason' in parsed) ||
      typeof parsed.reason !== 'string' ||
      !('lines' in parsed) ||
      !Array.isArray(parsed.lines)
    ) {
      sessionStorage.removeItem(pendingOpeningKey);
      return null;
    }
    const lines = parsed.lines.filter(
      (line): line is CreateStockOpeningRequest['lines'][number] =>
        typeof line === 'object' &&
        line !== null &&
        'warehouseId' in line &&
        typeof line.warehouseId === 'string' &&
        'stockItemId' in line &&
        typeof line.stockItemId === 'string' &&
        'condition' in line &&
        (line.condition === 'available' || line.condition === 'non_sellable') &&
        'quantity' in line &&
        typeof line.quantity === 'string' &&
        'unitCode' in line &&
        typeof line.unitCode === 'string',
    );
    if (lines.length !== parsed.lines.length) {
      sessionStorage.removeItem(pendingOpeningKey);
      return null;
    }
    return { requestId: parsed.requestId, reason: parsed.reason, lines };
  } catch {
    return null;
  }
}

export function loadOrCreateOpeningRequestId(): string {
  try {
    const existing = sessionStorage.getItem(openingRequestKey);
    if (
      existing &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)
    ) {
      return existing;
    }
    const created = crypto.randomUUID();
    sessionStorage.setItem(openingRequestKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function rotateOpeningRequestId(): string {
  const created = crypto.randomUUID();
  try {
    sessionStorage.setItem(openingRequestKey, created);
  } catch {
    // Keep the in-memory idempotency key when storage is unavailable.
  }
  return created;
}

export function savePendingOpening(opening: CreateStockOpeningRequest): void {
  try {
    sessionStorage.setItem(openingRequestKey, opening.requestId);
    sessionStorage.setItem(pendingOpeningKey, JSON.stringify(opening));
  } catch {
    // The in-memory request remains stable for retries in this page session.
  }
}

export function clearPendingOpening(): void {
  try {
    sessionStorage.removeItem(pendingOpeningKey);
  } catch {
    // The server remains authoritative for request idempotency.
  }
}
