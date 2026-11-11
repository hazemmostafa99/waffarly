'use client';

import { useMarketplaceSearch } from '@/features/marketplace/search/hooks/use-marketplace-search';
import { useMarketplaceNavigation } from '@/features/marketplace/navigation/hooks/use-marketplace-navigation';
import { MarketplaceHeader } from '@/features/marketplace/navigation/components/marketplace-header';
import { MarketplaceNavigationLinks } from '@/features/marketplace/navigation/components/marketplace-navigation-links';
import { MarketplaceMobileNav } from '@/features/marketplace/navigation/components/marketplace-mobile-nav';
import { MarketplaceMenu } from '@/features/marketplace/navigation/components/marketplace-menu';
import { MarketplacePendingFeature } from '@/features/marketplace/navigation/components/marketplace-pending-feature';

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
        onAccount={() => navigation.navigate({ kind: 'route', href: '/account' })}
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
