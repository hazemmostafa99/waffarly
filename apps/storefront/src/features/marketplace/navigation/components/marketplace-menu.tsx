import { cn } from '@waffarly/ui';
import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';
import { MarketplaceNavigationLinks } from '@/features/marketplace/navigation/components/marketplace-navigation-links';
import Link from 'next/link';
import type { CategoryId } from '@/features/marketplace/search/model/search-state';
import type { NavigationTarget } from '@/features/marketplace/navigation/model/navigation-items';

export function MarketplaceMenu({
  open,
  onClose,
  onNavigate,
  hrefFor,
  activeCategory,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: NavigationTarget) => void;
  hrefFor: (target: NavigationTarget) => string;
  activeCategory: CategoryId;
}) {
  return (
    <MarketplaceDialog id="marketplace-menu" title="القائمة" open={open} onClose={onClose}>
      <nav
        className={cn(
          'marketplace-menu-links grid gap-1 [&_:is(a,_button)]:block [&_:is(a,_button)]:text-primary [&_:is(a,_button)]:no-underline [&_:is(a,_button)]:bg-transparent [&_:is(a,_button)]:border-0',
          '[&_:is(a,_button)]:rounded-[10px] [&_:is(a,_button)]:p-3 [&_:is(a,_button)]:text-start [&_:is(a,_button)]:text-[14px] [&_:is(a,_button):hover]:bg-secondary [&_.active]:bg-secondary',
        )}
        aria-label="قائمة السوق والطلبات والمفضلة"
      >
        <MarketplaceNavigationLinks
          activeCategory={activeCategory}
          hrefFor={hrefFor}
          onNavigate={(target) => {
            onClose();
            onNavigate(target);
          }}
        />
        <Link href="/marketplace/orders" onClick={onClose}>
          طلباتي
        </Link>
        <Link href="/marketplace/favorites" onClick={onClose}>
          المفضلة
        </Link>
      </nav>
    </MarketplaceDialog>
  );
}
