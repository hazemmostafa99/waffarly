'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useMarketplaceSearch } from '../../search/use-marketplace-search';
import { productCategory } from '../../search/search-state';
import { useMarketplaceNavigation } from '../navigation/use-marketplace-navigation';
import { MarketplaceNavigationLinks } from '../navigation/marketplace-navigation-links';
import { MarketplaceMenu } from '../navigation/marketplace-menu';
import { MarketplacePendingFeature } from '../navigation/marketplace-pending-feature';
import { MarketplaceHeader } from '../navigation/marketplace-header';
import { MarketplaceHero } from './marketplace-hero';
import { MarketplaceStores } from './marketplace-stores';
import { MarketplaceRestaurants } from '../catalog/marketplace-restaurants';
import { MarketplaceCategories } from '../catalog/marketplace-categories';
import { MarketplaceFooter } from '../navigation/marketplace-footer';
import { MarketplaceMobileNav } from '../navigation/marketplace-mobile-nav';
import { MarketplaceProducts } from '../catalog/marketplace-products';
import { MarketplaceCart } from '../cart/marketplace-cart';

export function MarketplaceHome() {
  const search = useMarketplaceSearch();
  const navigation = useMarketplaceNavigation(search);
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
      <MarketplaceHeader
        searchState={search.state}
        onSearch={(state) => search.navigate(state)}
        menuOpen={navigation.menuOpen}
        onOpenMenu={() => navigation.setMenuOpen(true)}
        onPending={navigation.setPendingTitle}
        navigation={
          <MarketplaceNavigationLinks
            activeCategory={search.state.category}
            hrefFor={navigation.hrefFor}
            onNavigate={navigation.navigate}
          />
        }
      />
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
      <MarketplaceCart />
      <div className={`toast${toast ? ' show' : ''}`} role="status">
        {toast ? 'تمت إضافة المنتج للسلة ✓' : ''}
      </div>
      <MarketplaceMobileNav
        onHome={() => navigation.navigate({ kind: 'section', section: 'marketplace-main' })}
        onCategories={() => navigation.navigate({ kind: 'section', section: 'categories' })}
        onSearch={navigation.focusSearch}
        onAccount={() => navigation.setPendingTitle('account')}
      />
      <MarketplaceMenu
        open={navigation.menuOpen}
        onClose={() => navigation.setMenuOpen(false)}
        onNavigate={navigation.navigate}
        hrefFor={navigation.hrefFor}
        activeCategory={search.state.category}
      />
      <MarketplacePendingFeature
        feature={navigation.pendingTitle}
        onClose={() => navigation.setPendingTitle('')}
      />
    </>
  );
}
