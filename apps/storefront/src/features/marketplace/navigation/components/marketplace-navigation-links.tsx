import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  marketplaceNavigation,
  type NavigationTarget,
} from '@/features/marketplace/navigation/model/navigation-items';

export function MarketplaceNavigationLinks({
  activeCategory,
  onNavigate,
  hrefFor,
}: {
  activeCategory: string;
  onNavigate: (target: NavigationTarget) => void;
  hrefFor: (target: NavigationTarget) => string;
}) {
  const pathname = usePathname() ?? '';
  const currentPathname = pathname.replace(/\/+$/, '') || '/';
  const isMarketplaceHome = currentPathname === '/';

  function click(event: MouseEvent<HTMLAnchorElement>, target: NavigationTarget) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    // Let Next Link change route trees from a detail page. History-only updates
    // must never intercept a cross-page destination and leave stale product UI.
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (target.kind === 'route' || currentPath !== '/') return;
    event.preventDefault();
    onNavigate(target);
  }
  return marketplaceNavigation.map(({ label, target }) => {
    const active =
      target.kind === 'route'
        ? target.href === pathname
        : target.kind === 'category'
          ? isMarketplaceHome && target.category === activeCategory
          : isMarketplaceHome &&
            activeCategory === 'all' &&
            target.kind === 'section' &&
            target.section === 'marketplace-main';
    return target.kind === 'pending' ? (
      <Button
        type="button"
        key={label}
        className={'nav-pending disabled:cursor-not-allowed disabled:opacity-[0.5]'}
        onClick={() => onNavigate(target)}
      >
        {label}
      </Button>
    ) : (
      <Link
        key={label}
        href={hrefFor(target)}
        className={active ? 'active' : undefined}
        aria-current={active ? 'true' : undefined}
        onClick={(event) => click(event, target)}
      >
        {label}
      </Link>
    );
  });
}
