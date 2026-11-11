'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { useMarketplaceSearch } from '@/features/marketplace/search/hooks/use-marketplace-search';
import type { NavigationTarget } from '@/features/marketplace/navigation/model/navigation-items';

export function useMarketplaceNavigation(search: ReturnType<typeof useMarketplaceSearch>) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingTitle, setPendingTitle] = useState('');

  function navigate(target: NavigationTarget) {
    setMenuOpen(false);
    if (target.kind === 'pending') {
      setPendingTitle(target.title);
      return;
    }
    if (target.kind === 'route') {
      router.push(target.href);
      return;
    }
    if (target.kind === 'category') {
      search.navigate({ ...search.state, category: target.category });
      return;
    }
    search.navigate(
      target.section === 'marketplace-main' ? { category: 'all', term: '' } : search.state,
      target.section,
    );
  }

  function hrefFor(target: NavigationTarget) {
    if (target.kind === 'route') return target.href;
    if (target.kind === 'category')
      return search.href({ ...search.state, category: target.category });
    if (target.kind === 'section')
      return search.href(
        target.section === 'marketplace-main' ? { category: 'all', term: '' } : search.state,
        target.section,
      );
    return '#';
  }

  function focusSearch() {
    document.getElementById('searchForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('searchInput')?.focus({ preventScroll: true });
  }

  return { menuOpen, setMenuOpen, pendingTitle, setPendingTitle, navigate, hrefFor, focusSearch };
}
