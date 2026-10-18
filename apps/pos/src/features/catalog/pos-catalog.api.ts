import type { PosSellableCatalog } from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';

export const posCatalogKey = (merchantId: string) => ['pos', 'catalog', merchantId] as const;

export function getPosSellableCatalog(
  productCursor: string | undefined,
  signal: AbortSignal,
): Promise<PosSellableCatalog> {
  const params = new URLSearchParams();
  if (productCursor) params.set('productCursor', productCursor);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest(`/pos/catalog${query}`, { method: 'GET', signal });
}
