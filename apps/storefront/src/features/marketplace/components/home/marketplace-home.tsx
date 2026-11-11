'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import data from '../../data/reference.json';
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
  const [filter, setFilter] = useState({ category: 'all', term: '' });
  const [activeCategory, setActiveCategory] = useState(0);
  const typedTerm = useRef('');
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
  function chooseCategory(index: number) {
    setActiveCategory(index);
    setFilter({ category: data.categories[index]!.category, term: typedTerm.current });
    document.getElementById('deals')?.scrollIntoView({ behavior: 'smooth' });
  }
  return (
    <>
      <MarketplaceHeader
        onSearch={(category, term) => setFilter({ category, term })}
        onTermChange={(term) => {
          typedTerm.current = term;
        }}
      />
      <main id="marketplace-main" tabIndex={-1}>
        <MarketplaceContainer>
          <MarketplaceHero />
          <MarketplaceCategories activeCategory={activeCategory} onSelect={chooseCategory} />
          <MarketplaceRestaurants />
          <MarketplaceProducts category={filter.category} term={filter.term} onAdded={showToast} />
          <MarketplaceStores />
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
      <MarketplaceCart />
      <div className={`toast${toast ? ' show' : ''}`} role="status">
        {toast ? 'تمت إضافة المنتج للسلة ✓' : ''}
      </div>
      <MarketplaceMobileNav />
    </>
  );
}
