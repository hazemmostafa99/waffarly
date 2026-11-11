import { marketplaceSearchHref, parseMarketplaceSearch } from '../search/search-state';

export function productHref(id: string, search = '') {
  const state = parseMarketplaceSearch(new URLSearchParams(search));
  const params = new URLSearchParams();
  if (state.category !== 'all') params.set('category', state.category);
  if (state.term) params.set('q', state.term);
  return `/marketplace/products/${encodeURIComponent(id)}${params.size ? `?${params}` : ''}`;
}
export function productBackHref(search: string) {
  return marketplaceSearchHref(
    '/marketplace',
    '',
    parseMarketplaceSearch(new URLSearchParams(search)),
  );
}
