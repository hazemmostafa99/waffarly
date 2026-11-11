'use client';

import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cartQuantity } from '@/features/marketplace/cart/model/cart';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { MarketplaceSearchForm } from '@/features/marketplace/search/components/marketplace-search-form';
import type { MarketplaceSearchState } from '@/features/marketplace/search/model/search-state';

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
  const cartCount = useCartStore((s) => cartQuantity(s.cart));
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  return (
    <>
      <div
        className={cn(
          'promo bg-[linear-gradient(90deg,_var(--gold),_#ffe89c,_var(--gold))] text-[#32163a] text-center py-2 px-4 text-[13px] font-extrabold',
          '[&_b]:bg-[#32163a] [&_b]:text-[#fff] [&_b]:rounded-[99px] [&_b]:py-[3px] [&_b]:px-[9px] [&_b]:ms-1.5 [&_b]:me-1.5 max-[700px]:text-[10px]',
        )}
      >
        خصومات افتتاح وفّرلي <b>حتى 50%</b> من بائعين موثوقين
      </div>
      <header className={'top bg-primary text-[#fff]'}>
        <div
          className={cn(
            'marketplace-container top-main w-[min(1480px,_calc(100%_-_32px))] m-auto max-[700px]:w-[min(100%_-_20px,_1480px)] min-h-19.5 grid grid-cols-[auto_minmax(320px,_1fr)_auto]',
            'items-center gap-5.5 max-[1100px]:grid-cols-[auto_1fr] max-[700px]:gap-2.5 max-[700px]:pt-2',
          )}
        >
          <div className={'brand flex items-center gap-3'}>
            <Button
              type="button"
              className={cn(
                'menu-btn disabled:cursor-not-allowed disabled:opacity-[0.5] w-10.5 h-10.5 border border-solid [border-color:rgba(255,_255,_255,_0.2)]',
                'bg-transparent text-[#fff] rounded-[10px] text-[23px] max-[700px]:w-9.5 max-[700px]:h-9.5',
              )}
              aria-label="القائمة"
              aria-expanded={menuOpen}
              aria-controls="marketplace-menu"
              onClick={onOpenMenu}
            >
              ☰
            </Button>
            <Link href="/marketplace" aria-label="وفّرلي — الرئيسية">
              <img
                className={'logo w-40 h-12.5 object-contain block max-[700px]:w-[125px]'}
                src="/marketplace-assets/wafarly-logo.png"
                alt="وفّرلي"
              />
            </Link>
            <div
              className={cn(
                'deliver flex items-center gap-[7px] [border-right-width:1px] [border-right-style:solid] [border-right-color:rgba(255,_255,_255,_0.16)] pr-[15px]',
                '[&_small]:block [&_small]:text-[#d9cfe0] [&_small]:text-[11px] [&_strong]:text-[13px] max-[700px]:hidden',
              )}
            >
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
          <div
            className={
              'actions flex items-center gap-2 max-[1100px]:hidden [&_button.action]:border-0 [&_button.action]:bg-transparent [&_button.action]:text-start [&_button.action:hover]:bg-[rgba(255,_255,_255,_0.1)]'
            }
          >
            <Button
              type="button"
              className={cn(
                'action account disabled:cursor-not-allowed disabled:opacity-[0.5] text-[#fff] no-underline py-2.5 px-[11px]',
                'rounded-[10px] whitespace-nowrap hover:bg-[rgba(255,_255,_255,_0.1)] [&_strong]:text-[13px] [&_small]:block [&_small]:text-[#d9cfe0] [&_small]:text-[11px]',
              )}
              onClick={() => onPending('account')}
            >
              <small>مرحبًا، سجل دخولك</small>
              <strong>حسابي وقوائمي⌄</strong>
            </Button>
            <Link
              href="/marketplace/orders"
              className={cn(
                'action inline-block text-[#fff] no-underline py-2.5 px-[11px] rounded-[10px] hover:bg-[rgba(255,_255,_255,_0.1)]',
                'whitespace-nowrap hover:bg-[rgba(255,_255,_255,_0.1)] [&_strong]:text-[13px]',
              )}
            >
              <strong>طلباتي</strong>
            </Link>
            <Link
              href="/marketplace/favorites"
              className="action inline-block whitespace-nowrap rounded-[10px] px-[11px] py-2.5 text-[#fff] no-underline hover:bg-[rgba(255,_255,_255,_0.1)]"
              aria-label="المفضلة"
            >
              <strong>♡ المفضلة</strong>
            </Link>
            <Button
              type="button"
              className={cn(
                'action cart disabled:cursor-not-allowed disabled:opacity-[0.5] text-[#fff] no-underline py-2.5 px-[11px]',
                'rounded-[10px] whitespace-nowrap hover:bg-[rgba(255,_255,_255,_0.1)] [&_strong]:text-[13px] relative text-[24px] [&_em]:absolute [&_em]:right-[2px]',
                '[&_em]:top-[-6px] [&_em]:bg-waffarly-gold [&_em]:text-primary [&_em]:[font-style:normal] [&_em]:text-[11px] [&_em]:font-black [&_em]:rounded-[99px] [&_em]:min-w-[19px]',
                '[&_em]:h-[19px] [&_em]:grid [&_em]:place-items-center',
              )}
              onClick={() => setCartOpen(true)}
              aria-label="السلة"
            >
              🛒<em>{cartCount}</em>
            </Button>
          </div>
        </div>
      </header>
      <nav
        className={cn(
          'nav bg-[var(--purple-800)] text-[#fff] [&_a]:text-[#fff] [&_a]:no-underline [&_a]:text-[13px] [&_a]:font-bold [&_a]:whitespace-nowrap',
          '[&_a]:py-3 [&_a]:px-3.5 [&_a]:[border-bottom-width:3px] [&_a]:[border-bottom-style:solid] [&_a]:[border-bottom-color:transparent] [&_a:hover]:bg-[rgba(255,_255,_255,_0.08)] [&_a:hover]:border-waffarly-gold [&_a.active]:bg-[rgba(255,_255,_255,_0.08)]',
          '[&_a.active]:border-waffarly-gold max-[700px]:[&_a]:py-2.5 max-[700px]:[&_a]:px-[11px] max-[700px]:[&_a]:text-[11px] [&_.nav-pending]:text-[#fff] [&_.nav-pending]:bg-transparent [&_.nav-pending]:border-0 [&_.nav-pending]:[border-bottom-width:3px]',
          '[&_.nav-pending]:[border-bottom-style:solid] [&_.nav-pending]:[border-bottom-color:transparent] [&_.nav-pending]:py-3 [&_.nav-pending]:px-3.5 [&_.nav-pending]:text-[13px] [&_.nav-pending]:font-bold [&_.nav-pending]:whitespace-nowrap [&_.nav-pending:hover]:bg-[rgba(255,_255,_255,_0.08)]',
          '[&_.nav-pending:hover]:[border-bottom-color:var(--gold)] max-[700px]:[&_.nav-pending]:py-2.5 max-[700px]:[&_.nav-pending]:px-[11px] max-[700px]:[&_.nav-pending]:text-[11px]',
        )}
        aria-label="التنقل الرئيسي"
      >
        <div
          className={cn(
            'marketplace-container nav-row w-[min(1480px,_calc(100%_-_32px))] m-auto max-[700px]:w-[min(100%_-_20px,_1480px)] flex items-center gap-1.5',
            'overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {navigation}
        </div>
      </nav>
    </>
  );
}
