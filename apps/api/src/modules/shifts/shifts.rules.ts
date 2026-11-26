import { formatCents, toCents } from '../../common/money/money.js';

export function normalizeOpeningFloat(value: string): string {
  return formatCents(toCents(value));
}

/**
 * Names a safe transfer when the cashier gave no bag or receipt number, so the safe can
 * still match it to the drop. Uses the movement id's first block, e.g.
 * '1a2b3c4d-0000-...' -> 'DROP-1A2B3C4D'.
 */
export function safeDropFallbackReference(movementId: string): string {
  return `DROP-${movementId.slice(0, 8).toUpperCase()}`;
}

/** Same idea for a closed shift's custody handed to the safe, keyed by its request id. */
export function safeTransferFallbackReference(requestId: string): string {
  return `TRF-${requestId.slice(0, 8).toUpperCase()}`;
}
