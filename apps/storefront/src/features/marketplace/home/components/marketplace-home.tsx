'use client';

import { cn } from '@waffarly/ui';

import { useEffect, useRef, useState } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useMarketplaceSearch } from '@/features/marketplace/search/hooks/use-marketplace-search';
import { productCategory } from '@/features/marketplace/search/model/search-state';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceHero } from '@/features/marketplace/home/components/marketplace-hero';
import { MarketplaceStores } from '@/features/marketplace/home/components/marketplace-stores';
import { MarketplaceRestaurants } from '@/features/marketplace/catalog/components/marketplace-restaurants';
import { MarketplaceCategories } from '@/features/marketplace/catalog/components/marketplace-categories';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceProducts } from '@/features/marketplace/catalog/components/marketplace-products';

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
      <main id="marketplace-main" tabIndex={-1} className={'pb-20'}>
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
      <div
        className={cn(
          `toast${toast ? ' show' : ''}`,
          'fixed bottom-7 right-[28px] bg-[#21102a] text-[#fff] py-[13px] px-4.5 rounded-[12px] z-[50] [box-shadow:var(--shadow)] [transform:translateY(100px)] opacity-[0] [transition:0.25s] [&.show]:[transform:none] [&.show]:opacity-[1]',
        )}
        role="status"
      >
        {toast ? 'تمت إضافة المنتج للسلة ✓' : ''}
      </div>
    </>
  );
}
