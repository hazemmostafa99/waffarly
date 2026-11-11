import { cache } from 'react';
import {
  isStorefrontHandle,
  type PublicStorefrontAddress,
  type PublicStorefrontCatalog,
} from '@waffarly/contracts';
import { headers } from 'next/headers';
import { storefrontHostHandle } from '../../lib/storefront-address';
import { notFound } from 'next/navigation';
import { ApiError, apiGet } from '../../lib/api-client';

export const getStorefrontCatalog = cache(async (slug: string) => {
  let technicalSlug = slug;
  const handle = storefrontHostHandle((await headers()).get('host') ?? '');
  if (handle !== null) {
    if (!isStorefrontHandle(handle) || slug !== handle) notFound();
    const address = await apiGet<PublicStorefrontAddress>(
      `storefront-handles/${encodeURIComponent(handle)}`,
      { revalidate: 0 },
    );
    technicalSlug = address.storefrontSlug;
  }
  return apiGet<PublicStorefrontCatalog>(`catalog/stores/${encodeURIComponent(technicalSlug)}`, {
    revalidate: 300,
    tags: [`storefront:${technicalSlug}`, `catalog:${technicalSlug}`],
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
