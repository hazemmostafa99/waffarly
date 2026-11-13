'use client';

import { cn } from '@waffarly/ui';
import { Heart, MapPin, Menu, ShoppingCart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cartQuantity } from '@/features/marketplace/cart/model/cart';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { useAccountStore } from '@/features/marketplace/account/hooks/use-account-store';
import { useCustomerSession } from '@/features/marketplace/account/hooks/use-customer-session';
import { MarketplaceSearchForm } from '@/features/marketplace/search/components/marketplace-search-form';
import type { MarketplaceSearchState } from '@/features/marketplace/search/model/search-state';

export function MarketplaceHeader({
  onSearch,
  searchState,
  menuOpen,
  onOpenMenu,
  navigation,
}: {
  onSearch: (state: MarketplaceSearchState) => void;
  searchState: MarketplaceSearchState;
  menuOpen: boolean;
  onOpenMenu: () => void;
  navigation: ReactNode;
}) {
  const cartCount = useCartStore((s) => cartQuantity(s.cart));
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const isDemoAccountActive = useAccountStore((state) => state.isDemoAccountActive);
  const customerSession = useCustomerSession();
  const isCustomerSignedIn = Boolean(customerSession.data);
  const isDemoSessionActive = isDemoAccountActive && !isCustomerSignedIn;
  const leaveDemoAccount = useAccountStore((state) => state.leaveDemoAccount);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
        accountTriggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);

  function closeAccountMenu() {
    setAccountMenuOpen(false);
  }
  return (
    <>
      <div
        className={cn(
          'promo bg-[linear-gradient(90deg,_var(--gold),_#ffe89c,_var(--gold))] text-[#32163a] text-center py-2 px-4 text-[13px] font-medium',
          '[&_b]:bg-[#32163a] [&_b]:text-[#fff] [&_b]:rounded-[99px] [&_b]:py-[3px] [&_b]:px-[9px] [&_b]:ms-1.5 [&_b]:me-1.5 max-[700px]:text-[12px]',
        )}
      >
        خصومات افتتاح وفّرلي <b>حتى 50%</b> من بائعين موثوقين
      </div>
      <header className={'top bg-primary text-[#fff]'}>
        <div
          className={cn(
            'marketplace-container top-main w-[min(1480px,_calc(100%_-_32px))] m-auto max-[700px]:w-[min(100%_-_20px,_1480px)] min-h-18 grid grid-cols-[auto_minmax(320px,_1fr)_auto]',
            'items-center gap-5.5 max-[1100px]:grid-cols-[auto_1fr] max-[700px]:gap-2.5 max-[700px]:pt-2',
          )}
        >
          <div className={'brand flex items-center gap-3'}>
            <Button
              type="button"
              className={cn(
                'menu-btn disabled:cursor-not-allowed disabled:opacity-[0.5] w-10.5 h-10.5 border border-solid [border-color:rgba(255,_255,_255,_0.2)]',
                'bg-transparent text-[#fff] rounded-[10px] text-[23px] max-[700px]:w-9.5 max-[700px]:h-9.5 min-[1101px]:hidden',
              )}
              aria-label="القائمة"
              aria-expanded={menuOpen}
              aria-controls="marketplace-menu"
              onClick={onOpenMenu}
            >
              <Menu size={20} strokeWidth={1.75} aria-hidden="true" className="mx-auto" />
            </Button>
            <Link href="/" aria-label="وفّرلي — الرئيسية">
              <img
                className={'logo w-40 h-12.5 object-contain block max-[700px]:w-[125px]'}
                src="/marketplace-assets/wafarly-logo.png"
                alt="وفّرلي"
              />
            </Link>
            <div
              className={cn(
                'deliver flex items-center gap-[7px] [border-right-width:1px] [border-right-style:solid] [border-right-color:rgba(255,_255,_255,_0.16)] pr-[15px]',
                '[&_small]:block [&_small]:text-[#d9cfe0] [&_small]:text-[11px] [&_strong]:text-[13px] [&_strong]:font-medium max-[700px]:hidden',
              )}
            >
              <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
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
            <div
              ref={accountMenuRef}
              className="relative"
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  closeAccountMenu();
                }
              }}
            >
              <Button
                ref={accountTriggerRef}
                type="button"
                aria-haspopup="true"
                aria-expanded={accountMenuOpen}
                aria-controls="marketplace-account-menu"
                className={cn(
                  `action account inline-flex items-center gap-1.5 rounded-[10px] px-[11px] py-2.5 text-white transition-colors ${accountMenuOpen ? 'text-waffarly-gold' : ''}`,
                  'whitespace-nowrap hover:bg-[rgba(255,_255,_255,_0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-waffarly-gold focus-visible:ring-offset-2 focus-visible:ring-offset-primary',
                )}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="grid min-w-0 gap-0.5 text-start">
                  <small className="text-[11px] font-medium leading-none text-[#d9cfe0]">
                    {isCustomerSignedIn
                      ? `أهلاً ${customerSession.data?.displayName ?? 'بيك'}`
                      : isDemoSessionActive
                        ? 'أنت في حساب تجريبي'
                        : 'حساب وفّرلي'}
                  </small>
                  <strong className="text-[13px] font-medium leading-tight">
                    حسابي وقوائمي
                  </strong>
                </span>
                <span
                  aria-hidden="true"
                  className="grid size-4 shrink-0 place-items-center text-white/70"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className={cn(
                      'size-3 transition-transform duration-200 ease-out',
                      accountMenuOpen ? 'rotate-180' : '',
                    )}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m3.5 5.75 4.5 4.5 4.5-4.5" />
                  </svg>
                </span>
              </Button>
              {accountMenuOpen && (
                <div
                  id="marketplace-account-menu"
                  className="absolute start-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-border bg-white p-2 text-primary [box-shadow:var(--shadow)]"
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <p className="m-0 text-sm font-medium">
                      {isCustomerSignedIn
                        ? (customerSession.data?.displayName ?? 'حسابك على وفّرلي')
                        : isDemoSessionActive
                          ? 'حساب تجريبي'
                          : 'أهلاً بيك في وفّرلي'}
                    </p>
                    <p className="mb-0 mt-1 text-xs text-muted-foreground">
                      {isCustomerSignedIn
                        ? 'جلسة حسابك محفوظة على الخادم'
                        : isDemoSessionActive
                          ? 'جلسة مؤقتة على هذا الجهاز'
                          : 'اختار طريقة الدخول أو أنشئ حسابك'}
                    </p>
                  </div>
                  <nav aria-label="روابط الحساب" className="grid gap-0.5 py-1.5">
                    <Link
                      href="/account"
                      onClick={closeAccountMenu}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                    >
                      نظرة عامة على الحساب
                    </Link>
                    {!isCustomerSignedIn && !isDemoSessionActive && (
                      <>
                        <Link
                          href="/account/sign-in"
                          onClick={closeAccountMenu}
                          className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                        >
                          تسجيل الدخول
                        </Link>
                        <Link
                          href="/account/sign-up"
                          onClick={closeAccountMenu}
                          className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                        >
                          إنشاء حساب جديد
                        </Link>
                      </>
                    )}
                    <Link
                      href="/orders"
                      onClick={closeAccountMenu}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                    >
                      طلباتي
                    </Link>
                    <Link
                      href="/favorites"
                      onClick={closeAccountMenu}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                    >
                      المفضلة
                    </Link>
                    {isDemoSessionActive && (
                      <button
                        type="button"
                        onClick={() => {
                          leaveDemoAccount();
                          closeAccountMenu();
                        }}
                        className="rounded-lg border-0 bg-transparent px-3 py-2.5 text-start text-sm font-medium text-destructive hover:bg-red-50"
                      >
                        إنهاء الجلسة التجريبية
                      </button>
                    )}
                  </nav>
                </div>
              )}
            </div>
            <Link
              href="/orders"
              className={cn(
                'action inline-block text-[#fff] no-underline py-2.5 px-[11px] rounded-[10px] hover:bg-[rgba(255,_255,_255,_0.1)]',
                'whitespace-nowrap hover:bg-[rgba(255,_255,_255,_0.1)] [&_strong]:text-[13px] [&_strong]:font-medium',
              )}
            >
              <strong>طلباتي</strong>
            </Link>
            <Link
              href="/favorites"
              className="action inline-block whitespace-nowrap rounded-[10px] px-[11px] py-2.5 text-[#fff] no-underline hover:bg-[rgba(255,_255,_255,_0.1)]"
              aria-label="المفضلة"
            >
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                <Heart size={17} strokeWidth={1.75} aria-hidden="true" />
                المفضلة
              </span>
            </Link>
            <Button
              type="button"
              className={cn(
                'action cart disabled:cursor-not-allowed disabled:opacity-[0.5] text-[#fff] no-underline py-2.5 px-[11px]',
                'rounded-[10px] whitespace-nowrap hover:bg-[rgba(255,_255,_255,_0.1)] [&_strong]:text-[13px] [&_strong]:font-medium relative text-[20px] [&_em]:absolute [&_em]:right-[2px]',
                '[&_em]:top-[-6px] [&_em]:bg-waffarly-gold [&_em]:text-primary [&_em]:[font-style:normal] [&_em]:text-[11px] [&_em]:font-medium [&_em]:rounded-[99px] [&_em]:min-w-[19px]',
                '[&_em]:h-[19px] [&_em]:grid [&_em]:place-items-center',
              )}
              onClick={() => setCartOpen(true)}
              aria-label="السلة"
            >
              <ShoppingCart size={21} strokeWidth={1.75} aria-hidden="true" />
              <em>{cartCount}</em>
            </Button>
          </div>
        </div>
      </header>
      <nav
        className={cn(
          'nav bg-[var(--purple-800)] text-[#fff] [&_a]:text-[#fff] [&_a]:no-underline [&_a]:text-[13px] [&_a]:font-medium [&_a]:whitespace-nowrap',
          '[&_a]:py-3 [&_a]:px-3.5 [&_a]:[border-bottom-width:3px] [&_a]:[border-bottom-style:solid] [&_a]:[border-bottom-color:transparent] [&_a:hover]:bg-[rgba(255,_255,_255,_0.08)] [&_a:hover]:border-waffarly-gold [&_a.active]:bg-[rgba(255,_255,_255,_0.08)]',
          '[&_a.active]:border-waffarly-gold max-[700px]:[&_a]:py-2.5 max-[700px]:[&_a]:px-[11px] max-[700px]:[&_a]:text-[12px] [&_.nav-pending]:text-[#fff] [&_.nav-pending]:bg-transparent [&_.nav-pending]:border-0 [&_.nav-pending]:[border-bottom-width:3px]',
          '[&_.nav-pending]:[border-bottom-style:solid] [&_.nav-pending]:[border-bottom-color:transparent] [&_.nav-pending]:py-3 [&_.nav-pending]:px-3.5 [&_.nav-pending]:text-[13px] [&_.nav-pending]:font-medium [&_.nav-pending]:whitespace-nowrap [&_.nav-pending:hover]:bg-[rgba(255,_255,_255,_0.08)]',
          '[&_.nav-pending:hover]:[border-bottom-color:var(--gold)] max-[700px]:[&_.nav-pending]:py-2.5 max-[700px]:[&_.nav-pending]:px-[11px] max-[700px]:[&_.nav-pending]:text-[12px]',
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
