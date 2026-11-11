'use client';

import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';

export function MarketplaceMobileNav({
  onHome,
  onCategories,
  onSearch,
  onAccount,
}: {
  onHome: () => void;
  onCategories: () => void;
  onSearch: () => void;
  onAccount: () => void;
}) {
  const setCartOpen = useMarketplaceStore((s) => s.setCartOpen);
  const cartOpen = useMarketplaceStore((s) => s.cartOpen);
  const actions = [onHome, onCategories, onSearch, () => setCartOpen(true), onAccount];
  return (
    <nav className="mobile-nav" aria-label="تنقل الموبايل">
      {[
        ['⌂', 'الرئيسية'],
        ['▦', 'الأقسام'],
        ['⌕', 'بحث'],
        ['🛒', 'السلة'],
        ['♙', 'حسابي'],
      ].map(([icon, label], i) => (
        <button
          key={label}
          type="button"
          className={(cartOpen ? i === 3 : i === 0) ? 'active' : undefined}
          onClick={actions[i]}
        >
          <span>{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
