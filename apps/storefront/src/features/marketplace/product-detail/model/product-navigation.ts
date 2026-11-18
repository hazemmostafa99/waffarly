import {
  marketplaceSearchHref,
  parseMarketplaceSearch,
} from '@/features/marketplace/search/model/search-state';

export type HomeProductSection = 'products' | 'deals';
type ProductReturnContext = 'offers' | 'products' | 'home-products' | 'home-deals';

export function productHref(
  id: string,
  search = '',
  sourcePath = '',
  homeSection?: HomeProductSection,
) {
  const searchParams = new URLSearchParams(search);
  const state = parseMarketplaceSearch(searchParams);
  const params = new URLSearchParams();
  const restaurant = searchParams.get('restaurant');
  if (restaurant) params.set('restaurant', restaurant);
  if (state.category !== 'all') params.set('category', state.category);
  if (state.term) params.set('q', state.term);

  const isProductDetail = sourcePath.startsWith('/products/');
  const inheritedReturnTo = searchParams.get('returnTo');
  const validInheritedReturnTo: ProductReturnContext | null =
    inheritedReturnTo === 'offers' ||
    inheritedReturnTo === 'products' ||
    inheritedReturnTo === 'home-products' ||
    inheritedReturnTo === 'home-deals'
      ? inheritedReturnTo
      : null;
  let returnTo: ProductReturnContext | null = null;
  if (sourcePath === '/offers') returnTo = 'offers';
  else if (sourcePath === '/products') returnTo = 'products';
  else if (isProductDetail) returnTo = validInheritedReturnTo;
  else if (sourcePath === '/' && homeSection === 'products') {
    returnTo = 'home-products';
  } else if (sourcePath === '/' && homeSection === 'deals') {
    returnTo = 'home-deals';
  }

  if (returnTo) {
    params.set('returnTo', returnTo);
    if (returnTo === 'offers' || returnTo === 'products') {
      for (const key of ['sort', 'page']) {
        const value = searchParams.get(key);
        if (value) params.set(key, value);
      }
    }
  }

  return '/products/' + encodeURIComponent(id) + (params.size ? '?' + params.toString() : '');
}

export function productBackHref(search: string) {
  const params = new URLSearchParams(search);
  const returnTo = params.get('returnTo');
  if (returnTo === 'home-products' || returnTo === 'home-deals') {
    const section = returnTo === 'home-products' ? 'products' : 'deals';
    return marketplaceSearchHref('/', '', parseMarketplaceSearch(params), section);
  }

  if (returnTo === 'offers' || returnTo === 'products') {
    const listingParams = new URLSearchParams();
    for (const key of ['category', 'q', 'sort', 'page']) {
      const value = params.get(key);
      if (value) listingParams.set(key, value);
    }
    const query = listingParams.toString();
    const pathname = returnTo === 'offers' ? '/offers' : '/products';
    return pathname + (query ? '?' + query : '');
  }

  return marketplaceSearchHref('/', '', parseMarketplaceSearch(new URLSearchParams(search)));
}
