import {
  marketplaceSearchHref,
  parseMarketplaceSearch,
} from '@/features/marketplace/search/model/search-state';

export function productHref(id: string, search = '', sourcePath = '') {
  const searchParams = new URLSearchParams(search);
  const state = parseMarketplaceSearch(searchParams);
  const params = new URLSearchParams();
  if (state.category !== 'all') params.set('category', state.category);
  if (state.term) params.set('q', state.term);

  const isProductDetail = sourcePath.startsWith('/marketplace/products/');
  const returnTo = sourcePath === '/marketplace/offers'
    ? 'offers'
    : sourcePath === '/marketplace/products' ||
        (isProductDetail && searchParams.get('returnTo') === 'products')
      ? 'products'
      : isProductDetail && searchParams.get('returnTo') === 'offers'
        ? 'offers'
        : null;

  if (returnTo) {
    params.set('returnTo', returnTo);
    for (const key of ['sort', 'page']) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
  }

  return '/marketplace/products/' + encodeURIComponent(id) +
    (params.size ? '?' + params.toString() : '');
}

export function productBackHref(search: string) {
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  if (returnTo === 'offers' || returnTo === 'products') {
    const listingParams = new URLSearchParams();
    for (const key of ['category', 'q', 'sort', 'page']) {
      const value = params.get(key);
      if (value) listingParams.set(key, value);
    }
    const query = listingParams.toString();
    const pathname = returnTo === 'offers' ? '/marketplace/offers' : '/marketplace/products';
    return pathname + (query ? '?' + query : '');
  }

  return marketplaceSearchHref(
    '/marketplace',
    '',
    parseMarketplaceSearch(new URLSearchParams(search)),
  );
}
