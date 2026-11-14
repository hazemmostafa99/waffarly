'use client';

import { Home, LayoutGrid, Search, ShoppingCart, UserRound } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@waffarly/ui';
import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { cartQuantity } from '@/features/marketplace/cart/model/cart';

export function MarketplaceMobileNav({ onHome, onCategories, onSearch, onAccount }: {
  onHome: () => void;
  onCategories: () => void;
  onSearch: () => void;
  onAccount: () => void;
}) {
  const setCartOpen = useCartStore((state) => state.setCartOpen);
  const cartOpen = useCartStore((state) => state.cartOpen);
  const count = useCartStore((state) => cartQuantity(state.cart));
  const pathname = usePathname();
  const params = useSearchParams();
  const category = params.get('category');
  const active = cartOpen || pathname === '/cart' ? 'cart'
    : pathname?.startsWith('/account') || pathname?.startsWith('/orders') ? 'account'
    : pathname === '/' && params.get('q') ? 'search'
    : pathname === '/' && category && category !== 'all' ? 'categories'
    : pathname === '/' ? 'home' : null;
  const items = [
    { id: 'home', label: 'الرئيسية', Icon: Home, action: onHome },
    { id: 'categories', label: 'الأقسام', Icon: LayoutGrid, action: onCategories },
    { id: 'search', label: 'بحث', Icon: Search, action: onSearch },
    { id: 'cart', label: 'السلة', Icon: ShoppingCart, action: () => setCartOpen(true) },
    { id: 'account', label: 'حسابي', Icon: UserRound, action: onAccount },
  ];
  return <nav aria-label="تنقل الموبايل" className="fixed inset-x-0 bottom-0 z-20 hidden grid-cols-5 border-t border-border bg-card px-1 pt-1.5 pb-[calc(6px_+_env(safe-area-inset-bottom))] shadow-[0_-5px_20px_rgba(42,7,59,0.08)] max-[700px]:grid">
    {items.map(({ id, label, Icon, action }) => <Button key={id} type="button" onClick={action} aria-current={active === id ? 'page' : undefined} aria-label={id === 'cart' ? `السلة، ${count} منتجات` : label} className={cn('relative grid min-h-12 place-items-center gap-1 rounded-xl border-0 bg-transparent py-1 text-[10px] text-muted-foreground focus-visible:outline-2 focus-visible:outline-accent', active === id && 'bg-secondary font-bold text-accent')}>
      <span className="relative"><Icon size={21} strokeWidth={1.75} aria-hidden="true" />{id === 'cart' && count > 0 && <span className="absolute -end-2 -top-1 grid min-w-4 place-items-center rounded-full bg-waffarly-gold px-1 text-[9px] font-bold text-primary">{count}</span>}</span>
      {label}
    </Button>)}
  </nav>;
}
