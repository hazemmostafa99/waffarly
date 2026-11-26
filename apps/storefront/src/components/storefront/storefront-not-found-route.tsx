import { headers } from 'next/headers';
import { isStorefrontHandle } from '@waffarly/contracts';
import { ApiError } from '../../lib/api-client';
import { getStorefrontCatalog } from '../../features/catalog/storefront-data';
import { marketplaceHomeHref, storefrontRequestHandle } from '../../lib/storefront-address';
import { StorefrontNotFound } from './storefront-not-found';

export async function StorefrontNotFoundRoute() {
  const requestHeaders = await headers();
  const handle = storefrontRequestHandle(requestHeaders);
  let missingBusiness = false;

  if (handle && handle !== 'marketplace') {
    if (!isStorefrontHandle(handle)) {
      missingBusiness = true;
    } else {
      try {
        await getStorefrontCatalog(handle);
      } catch (error) {
        missingBusiness = error instanceof ApiError && error.statusCode === 404;
      }
    }
  }

  return (
    <StorefrontNotFound
      hostBased={handle !== null}
      missingBusiness={missingBusiness}
      {...(missingBusiness ? { homeHref: marketplaceHomeHref(requestHeaders.get('host') ?? '') } : {})}
    />
  );
}
