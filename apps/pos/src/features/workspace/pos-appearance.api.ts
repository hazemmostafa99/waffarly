import type { PosAppearanceSummary } from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posAppearanceKey = (merchantId: string) => ['pos', 'appearance', merchantId] as const;

export function getPosAppearance(): Promise<PosAppearanceSummary> {
  return apiRequest('/pos/appearance', { method: 'GET' });
}
