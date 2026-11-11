'use client';

import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';

export function MarketplaceMobileNav() {
  const setCartOpen = useMarketplaceStore((s) => s.setCartOpen);
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
          className={i === 0 ? 'active' : undefined}
          onClick={i === 3 ? () => setCartOpen(true) : undefined}
        >
          <span>{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
