'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cartQuantity } from '../../model/catalog';
import { useMarketplaceStore } from '@/features/marketplace/providers/marketplace-providers';
import { MarketplaceSearchForm } from '../../search/marketplace-search-form';
import type { MarketplaceSearchState } from '../../search/search-state';

export function MarketplaceHeader({
  onSearch,
  searchState,
  menuOpen,
  onOpenMenu,
  onPending,
  navigation,
}: {
  onSearch: (state: MarketplaceSearchState) => void;
  searchState: MarketplaceSearchState;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onPending: (title: string) => void;
  navigation: ReactNode;
}) {
  const cartCount = useMarketplaceStore((s) => cartQuantity(s.cart));
  const setCartOpen = useMarketplaceStore((s) => s.setCartOpen);
  return (
    <>
      <div className="promo">
        خصومات افتتاح وفّرلي <b>حتى 50%</b> من بائعين موثوقين
      </div>
      <header className="top">
        <div className="container top-main">
          <div className="brand">
            <button
              type="button"
              className="menu-btn"
              aria-label="القائمة"
              aria-expanded={menuOpen}
              aria-controls="marketplace-menu"
              onClick={onOpenMenu}
            >
              ☰
            </button>
            <Link href="/marketplace" aria-label="وفّرلي — الرئيسية">
              <img className="logo" src="/marketplace-assets/wafarly-logo.png" alt="وفّرلي" />
            </Link>
            <div className="deliver">
              <span>📍</span>
              <div>
                <small>التوصيل إلى</small>
                <strong>دمياط الجديدة</strong>
              </div>
            </div>
          </div>
          <MarketplaceSearchForm
            key={`${searchState.category}:${searchState.term}`}
            initialState={searchState}
            onSearch={onSearch}
          />
          <div className="actions">
            <button type="button" className="action account" onClick={() => onPending('account')}>
              <small>مرحبًا، سجل دخولك</small>
              <strong>حسابي وقوائمي⌄</strong>
            </button>
            <button type="button" className="action" onClick={() => onPending('orders')}>
              <strong>طلباتي</strong>
            </button>
            <button
              type="button"
              className="action cart"
              onClick={() => setCartOpen(true)}
              aria-label="السلة"
            >
              🛒<em>{cartCount}</em>
            </button>
          </div>
        </div>
      </header>
      <nav className="nav" aria-label="التنقل الرئيسي">
        <div className="container nav-row">{navigation}</div>
      </nav>
    </>
  );
}
