'use client';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import { cn } from '@waffarly/ui';

import { usePathname } from 'next/navigation';

import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';

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
  const setCartOpen = useCartStore((s) => s.setCartOpen);
  const cartOpen = useCartStore((s) => s.cartOpen);
  const pathname = usePathname();
  const onCartPage = pathname === '/cart';
  const onAccountPage = pathname === '/account';
  const actions = [onHome, onCategories, onSearch, () => setCartOpen(true), onAccount];
  return (
    <nav
      className={cn(
        'mobile-nav hidden max-[700px]:grid max-[700px]:fixed max-[700px]:z-[20] max-[700px]:bottom-0 max-[700px]:right-0 max-[700px]:left-0',
        'max-[700px]:bg-white max-[700px]:[border-top-width:1px] max-[700px]:[border-top-style:solid] max-[700px]:[border-top-color:var(--line)] max-[700px]:grid-cols-5 max-[700px]:pt-2 max-[700px]:px-1 max-[700px]:pb-[calc(8px_+_env(safe-area-inset-bottom))]',
        'max-[700px]:[box-shadow:0_-5px_20px_rgba(42,_7,_59,_0.08)] max-[700px]:[&_button]:border-0 max-[700px]:[&_button]:bg-transparent max-[700px]:[&_button]:text-[#62596a] max-[700px]:[&_button]:text-[10px] max-[700px]:[&_span]:text-[19px] max-[700px]:[&_span]:block max-[700px]:[&_span]:mb-[3px]',
        'max-[700px]:[&_.active]:text-accent max-[700px]:[&_.active]:font-black',
      )}
      aria-label="تنقل الموبايل"
    >
      {[
        ['⌂', 'الرئيسية'],
        ['▦', 'الأقسام'],
        ['⌕', 'بحث'],
        ['🛒', 'السلة'],
        ['♙', 'حسابي'],
      ].map(([icon, label], i) => (
        <Button
          key={label}
          type="button"
          className={cn(
            (cartOpen || onCartPage ? i === 3 : onAccountPage ? i === 4 : i === 0)
              ? 'active'
              : undefined,
            'disabled:cursor-not-allowed disabled:opacity-[0.5]',
          )}
          onClick={actions[i]}
        >
          <span>{icon}</span>
          {label}
        </Button>
      ))}
    </nav>
  );
}
