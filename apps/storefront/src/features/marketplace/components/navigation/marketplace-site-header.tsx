'use client';

import { useMarketplaceSearch } from '../../search/use-marketplace-search';
import { useMarketplaceNavigation } from './use-marketplace-navigation';
import { MarketplaceHeader } from './marketplace-header';
import { MarketplaceNavigationLinks } from './marketplace-navigation-links';
import { MarketplaceMobileNav } from './marketplace-mobile-nav';
import { MarketplaceMenu } from './marketplace-menu';
import { MarketplacePendingFeature } from './marketplace-pending-feature';

// One complete storefront header on listing and detail routes.
export function MarketplaceSiteHeader() {
  const search = useMarketplaceSearch();
  const navigation = useMarketplaceNavigation(search);
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
