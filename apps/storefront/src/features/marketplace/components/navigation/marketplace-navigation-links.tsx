import type { MouseEvent } from 'react';
import { marketplaceNavigation, type NavigationTarget } from './navigation-items';

export function MarketplaceNavigationLinks({
  activeCategory,
  onNavigate,
  hrefFor,
}: {
  activeCategory: string;
  onNavigate: (target: NavigationTarget) => void;
  hrefFor: (target: NavigationTarget) => string;
}) {
  function click(event: MouseEvent<HTMLAnchorElement>, target: NavigationTarget) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onNavigate(target);
  }
  return marketplaceNavigation.map(({ label, target }) => {
    const active =
      target.kind === 'category'
        ? target.category === activeCategory
        : activeCategory === 'all' &&
          target.kind === 'section' &&
          target.section === 'marketplace-main';
    return target.kind === 'pending' ? (
      <button type="button" key={label} className="nav-pending" onClick={() => onNavigate(target)}>
        {label}
      </button>
    ) : (
      <a
        key={label}
        href={hrefFor(target)}
        className={active ? 'active' : undefined}
        aria-current={active ? 'true' : undefined}
        onClick={(event) => click(event, target)}
      >
        {label}
      </a>
    );
  });
}
