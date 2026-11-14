'use client';


import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useMarketplaceSearch } from '@/features/marketplace/search/hooks/use-marketplace-search';
import { productCategory } from '@/features/marketplace/search/model/search-state';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceHero } from '@/features/marketplace/home/components/marketplace-hero';
import { MarketplaceStores } from '@/features/marketplace/stores/components/marketplace-stores';
import { MarketplaceRestaurants } from '@/features/marketplace/restaurants/components/marketplace-restaurants';
import { MarketplaceCategories } from '@/features/marketplace/catalog/components/marketplace-categories';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceProducts } from '@/features/marketplace/catalog/components/marketplace-products';

export function MarketplaceHome() {
  const search = useMarketplaceSearch();
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
          />
          <MarketplaceStores />
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />

    </>
  );
}
