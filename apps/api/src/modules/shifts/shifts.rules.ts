import { formatCents, toCents } from '../../common/money/money.js';

export function normalizeOpeningFloat(value: string): string {
  return formatCents(toCents(value));
}
