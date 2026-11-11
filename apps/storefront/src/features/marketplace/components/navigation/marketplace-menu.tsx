import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';
import { MarketplaceNavigationLinks } from './marketplace-navigation-links';
import type { CategoryId } from '../../search/search-state';
import type { NavigationTarget } from './navigation-items';

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
      <nav className="marketplace-menu-links" aria-label="قائمة الأقسام والمتاجر">
        <MarketplaceNavigationLinks
          activeCategory={activeCategory}
          hrefFor={hrefFor}
          onNavigate={(target) => {
            onClose();
            onNavigate(target);
          }}
        />
      </nav>
    </MarketplaceDialog>
  );
}
