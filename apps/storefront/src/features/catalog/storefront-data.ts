import { cache } from 'react';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { notFound } from 'next/navigation';
import { ApiError, apiGet } from '../../lib/api-client';

export const getStorefrontCatalog = cache(async (slug: string) => {
  return apiGet<PublicStorefrontCatalog>(`catalog/stores/${encodeURIComponent(slug)}`, {
    revalidate: 300,
    tags: [`storefront:${slug}`, `catalog:${slug}`],
  });
});

export async function requireStorefrontCatalog(slug: string): Promise<PublicStorefrontCatalog> {
  try {
    return await getStorefrontCatalog(slug);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }
}
