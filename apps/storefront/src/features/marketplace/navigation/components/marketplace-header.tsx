'use client';

import { cn } from '@waffarly/ui';
import { Heart, MapPin, Menu, ShoppingCart, UserRound, X, ShoppingBag, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import { useCustomerSignOut } from '@/features/marketplace/account/hooks/use-customer-sign-out';
import { customerName } from '@/features/marketplace/account/model/customer-name';
import { useFavoritesStore } from '@/features/marketplace/favorites/hooks/use-favorites-store';
import { useCustomerOrders } from '@/features/marketplace/orders/hooks/use-customer-orders';
import { isFinishedOrder } from '@/features/marketplace/orders/model/customer-order-presentation';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const [promoVisible, setPromoVisible] = useState(true);
  const pathname = usePathname();
  const { query: ordersQuery } = useCustomerOrders();
  const activeOrder = !ordersQuery.isError ? ordersQuery.data?.pages.flatMap((page) => page.items).find((order) => !isFinishedOrder(order.status)) : undefined;
  const activeOrderId = activeOrder?.id;
  const refreshOrders = ordersQuery.refetch;
  const cartCount = useCartStore((s) => cartQuantity(s.cart));
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const isDemoAccountActive = useAccountStore((state) => state.isDemoAccountActive);
  const customerSession = useCustomerSession();
  const isCustomerSignedIn = Boolean(customerSession.data);
  const name = customerName(customerSession.data?.displayName);
  const logout = useCustomerSignOut();
  const favoriteCount = useFavoritesStore((state) => state.favorites.length);
  const isDemoSessionActive = isDemoAccountActive && !isCustomerSignedIn;
  const leaveDemoAccount = useAccountStore((state) => state.leaveDemoAccount);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!customerSession.isPending) void refreshOrders();
  }, [pathname, customerSession.isPending, refreshOrders]);

  useEffect(() => {
    if (!activeOrderId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshOrders();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [activeOrderId, refreshOrders]);

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
      {promoVisible && <div
        className={cn(
          'relative promo bg-[linear-gradient(90deg,_var(--gold),_#ffe89c,_var(--gold))] text-[#32163a] text-center py-1.5 px-10 text-[12px] font-medium',
          '[&_b]:bg-[#32163a] [&_b]:text-[#fff] [&_b]:rounded-[99px] [&_b]:py-[3px] [&_b]:px-[9px] [&_b]:ms-1.5 [&_b]:me-1.5 max-[700px]:text-[12px]',
        )}
      >
        خصومات افتتاح وفّرلي <b>حتى 50%</b> من بائعين موثوقين
        <button type="button" onClick={() => setPromoVisible(false)} aria-label="إغلاق شريط العروض" title="إغلاق شريط العروض" className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"><X size={15} aria-hidden="true" /></button>
      </div>}
      <header className={'top bg-primary text-[#fff]'}>
        <div
          className={cn(
            'marketplace-container top-main relative w-[min(1480px,_calc(100%_-_32px))] m-auto max-[700px]:w-[min(100%_-_20px,_1480px)] min-h-20 py-3 grid grid-cols-[auto_minmax(0,_1fr)_auto]',
            'items-center gap-5 max-[1100px]:grid-cols-[minmax(0,1fr)_auto] max-[1100px]:gap-3 max-[700px]:gap-2 max-[700px]:py-2',
          )}
        >
          <div className={'brand flex min-w-0 items-center gap-3 max-[700px]:gap-2'}>
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
                className={'logo w-36 h-11 object-contain block max-[700px]:w-[72px] max-[700px]:h-9'}
                src="/marketplace-assets/wafarly-logo.png"
                alt="وفّرلي"
              />
            </Link>
            <div
              className={cn(
                'deliver min-w-0 max-w-36 flex items-center gap-[7px] [border-right-width:1px] [border-right-style:solid] [border-right-color:rgba(255,_255,_255,_0.16)] pr-[15px]',
                '[&_small]:block [&_small]:text-[#d9cfe0] [&_small]:text-[11px] [&_strong]:text-[13px] [&_strong]:font-medium max-[700px]:hidden',
              )}
            >
              <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
              <div>
                <small>التوصيل إلى</small>
                <strong className="block truncate" title="دمياط الجديدة">دمياط الجديدة</strong>
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
              'actions flex items-center gap-1 max-[700px]:gap-0 max-[1100px]:col-start-2 max-[1100px]:row-start-1 [&_button.action]:border-0 [&_button.action]:bg-transparent [&_button.action]:text-start [&_button.action:hover]:bg-[rgba(255,_255,_255,_0.1)]'
            }
          >
            <div
              ref={accountMenuRef}
              className="relative max-[700px]:static"
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  closeAccountMenu();
                }
              }}
            >
              <Button
                ref={accountTriggerRef}
                type="button"
                aria-label={isCustomerSignedIn ? `حساب ${name.full}، مسجّل دخول` : isDemoSessionActive ? 'حساب تجريبي' : 'قائمة الحساب وتسجيل الدخول'}
                title={isCustomerSignedIn ? `${name.full} — مسجّل دخول` : isDemoSessionActive ? 'حساب تجريبي' : 'تسجيل الدخول'}
                aria-haspopup="true"
                aria-expanded={accountMenuOpen}
                aria-controls="marketplace-account-menu"
                className={cn(
                  `group/account action account inline-flex items-center gap-1.5 rounded-[10px] min-h-11 px-2.5 max-[700px]:px-2 py-2 text-white transition-colors ${accountMenuOpen ? 'text-waffarly-gold' : ''}`,
                  'whitespace-nowrap hover:bg-[rgba(255,_255,_255,_0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-waffarly-gold focus-visible:ring-offset-2 focus-visible:ring-offset-primary',
                )}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                {isCustomerSignedIn ? (
                  <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-full border border-white/25 bg-[#b99aca]/20 text-[13px] font-bold leading-none text-[#f5eff8] transition-colors group-hover/account:bg-[#b99aca]/30 group-focus-visible/account:bg-[#b99aca]/30', accountMenuOpen && 'bg-[#b99aca]/30')}><bdi>{name.initials}</bdi></span>
                ) : (
                  <>
                    <UserRound size={20} strokeWidth={1.75} aria-hidden="true" />
                    <span className="hidden text-[13px] font-medium min-[701px]:inline">{isDemoSessionActive ? 'حساب تجريبي' : 'تسجيل الدخول'}</span>
                  </>
                )}
                <span
                  aria-hidden="true"
                  className="hidden size-4 shrink-0 place-items-center text-white/70 min-[701px]:grid"
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
                  className="absolute end-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-border bg-white p-2 text-primary [box-shadow:var(--shadow)] max-[700px]:start-2 max-[700px]:end-2 max-[700px]:top-full max-[700px]:w-auto"
                >
                  <div className="flex items-center gap-3 border-b border-border px-3 py-4">
                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold text-accent">{isCustomerSignedIn ? name.initials : <UserRound size={21} />}</span>
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-bold">{isCustomerSignedIn ? <>أهلًا، <bdi>{name.first}</bdi></> : isDemoSessionActive ? 'حساب تجريبي' : 'أهلًا بيك'}</p>
                      {isCustomerSignedIn && <p className="mb-0 mt-1 break-words text-xs leading-5 text-muted-foreground"><bdi>{name.full}</bdi></p>}
                    </div>
                  </div>
                  <nav aria-label="روابط الحساب" className="grid gap-0.5 py-1.5">
                    <Link
                      href="/account"
                      onClick={closeAccountMenu}
                      className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                    >
                      <UserRound size={17} aria-hidden="true" />حسابي
                    </Link>
                    {!isCustomerSignedIn && !isDemoSessionActive && (
                      <>
                        <Link
                          href="/account/sign-in"
                          onClick={closeAccountMenu}
                          className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                        >
                          تسجيل الدخول
                        </Link>
                        <Link
                          href="/account/sign-up"
                          onClick={closeAccountMenu}
                          className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                        >
                          إنشاء حساب جديد
                        </Link>
                      </>
                    )}
                    <Link
                      href="/orders"
                      onClick={closeAccountMenu}
                      className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                    >
                      <ShoppingBag size={17} aria-hidden="true" />طلباتي
                    </Link>
                    <Link
                      href="/favorites"
                      onClick={closeAccountMenu}
                      className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-primary no-underline hover:bg-secondary"
                    >
                      <Heart size={17} aria-hidden="true" />المفضلة<span className="ms-auto rounded-md bg-secondary px-2 text-xs text-accent">{favoriteCount}</span>
                    </Link>
                    {isCustomerSignedIn && <div className="mt-1 border-t border-border pt-1">
                      <button type="button" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: closeAccountMenu })} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm text-destructive hover:bg-red-50 disabled:opacity-50"><LogOut size={17} aria-hidden="true" />{logout.isPending ? 'جارٍ الخروج…' : 'تسجيل الخروج'}</button>
                      {logout.isError && <p role="alert" className="px-3 text-xs leading-5 text-destructive">تعذّر تسجيل الخروج. حاول مرة أخرى.</p>}
                    </div>}
                    <p className="mx-3 my-2 text-[11px] leading-5 text-muted-foreground">المفضلة محفوظة على المتصفح ده، ومش مرتبطة بالحساب.</p>
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
            <Link href="/orders" title={activeOrder ? 'طلباتي — عندك طلب جارٍ' : 'طلباتي'} aria-label={activeOrder ? 'طلباتي، عندك طلب جارٍ' : 'طلباتي'} className="action relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 max-[700px]:px-2 text-white no-underline hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-waffarly-gold">
              <ShoppingBag size={20} strokeWidth={1.75} aria-hidden="true" /><span className="hidden text-[13px] font-medium min-[701px]:inline">طلباتي</span>
              {activeOrder && <span aria-hidden="true" className="absolute end-1.5 top-1.5 size-2 rounded-full bg-waffarly-gold ring-2 ring-primary" />}
            </Link>
            <Link
              href="/favorites"
              className="action grid size-11 shrink-0 place-items-center rounded-xl text-white no-underline hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-waffarly-gold"
              aria-label="المفضلة"
              title="المفضلة"
            >
              <Heart size={21} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <Button
              type="button"
              className={cn(
                'action cart disabled:cursor-not-allowed disabled:opacity-[0.5] grid size-11 shrink-0 place-items-center text-[#fff] no-underline',
                'rounded-[10px] whitespace-nowrap hover:bg-[rgba(255,_255,_255,_0.1)] [&_strong]:text-[13px] [&_strong]:font-medium relative text-[20px] [&_em]:absolute [&_em]:right-[2px]',
                '[&_em]:top-[-1px] [&_em]:bg-waffarly-gold [&_em]:text-primary [&_em]:[font-style:normal] [&_em]:text-[11px] [&_em]:font-medium [&_em]:rounded-[99px] [&_em]:min-w-[19px]',
                '[&_em]:h-[19px] [&_em]:grid [&_em]:place-items-center',
              )}
              onClick={() => setCartOpen(true)}
              aria-label={`السلة، ${cartCount} منتجات`}
              title="السلة"
            >
              <ShoppingCart size={21} strokeWidth={1.75} aria-hidden="true" />
              {cartCount > 0 && <em>{cartCount}</em>}
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
