'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useMarketplaceSearch } from '../../search/use-marketplace-search';
import { productCategory } from '../../search/search-state';
import { MarketplaceSiteHeader } from '../navigation/marketplace-site-header';
import { MarketplaceHero } from './marketplace-hero';
import { MarketplaceStores } from './marketplace-stores';
import { MarketplaceRestaurants } from '../catalog/marketplace-restaurants';
import { MarketplaceCategories } from '../catalog/marketplace-categories';
import { MarketplaceFooter } from '../navigation/marketplace-footer';
import { MarketplaceProducts } from '../catalog/marketplace-products';

export function MarketplaceHome() {
  const search = useMarketplaceSearch();
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  function showToast() {
    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 1800);
  }
  return (
    <>
      <MarketplaceSiteHeader />
      <main id="marketplace-main" tabIndex={-1}>
        <MarketplaceContainer>
          <MarketplaceHero />
          <MarketplaceCategories
            activeCategory={search.state.category}
            onSelect={(category) => search.navigate({ ...search.state, category })}
          />
          <MarketplaceRestaurants />
          <MarketplaceProducts
            category={productCategory(search.state.category)}
            term={search.state.term}
            onAdded={showToast}
          />
          <MarketplaceStores />
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
      <div className={`toast${toast ? ' show' : ''}`} role="status">
        {toast ? 'تمت إضافة المنتج للسلة ✓' : ''}
      </div>
    </>
  );
}
