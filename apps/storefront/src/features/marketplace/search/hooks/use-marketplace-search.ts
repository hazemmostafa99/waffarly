'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  marketplaceSearchHref,
  parseMarketplaceSearch,
  type MarketplaceSearchState,
} from '@/features/marketplace/search/model/search-state';

export function useMarketplaceSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const state = parseMarketplaceSearch(params);

  function href(next: MarketplaceSearchState, section = 'deals') {
    return marketplaceSearchHref('/marketplace', params.toString(), next, section);
  }

  function navigate(next: MarketplaceSearchState, section = 'deals') {
    const url = marketplaceSearchHref('/marketplace', window.location.search, next, section);
    if (window.location.pathname.replace(/\/+$/, '') !== '/marketplace') {
      router.push(url);
      return;
    }
    // Next's native History integration updates useSearchParams without a data request.
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
      window.history.pushState(null, '', url);
    }
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
  }

  return { state, href, navigate };
}
