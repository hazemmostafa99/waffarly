'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  marketplaceSearchHref,
  parseMarketplaceSearch,
  type MarketplaceSearchState,
} from './search-state';

export function useMarketplaceSearch() {
  const pathname = usePathname();
  const params = useSearchParams();
  const state = parseMarketplaceSearch(params);

  function href(next: MarketplaceSearchState, section = 'deals') {
    return marketplaceSearchHref(pathname, params.toString(), next, section);
  }

  function navigate(next: MarketplaceSearchState, section = 'deals') {
    const url = marketplaceSearchHref(pathname, window.location.search, next, section);
    // Next's native History integration updates useSearchParams without a data request.
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
      window.history.pushState(null, '', url);
    }
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
  }

  return { state, href, navigate };
}
