import { MarketplaceHome } from '@/features/marketplace/components/home/marketplace-home';
import { Suspense } from 'react';

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <main id="marketplace-main" className="container" aria-busy="true">
          جارٍ تجهيز المتجر…
        </main>
      }
    >
      <MarketplaceHome />
    </Suspense>
  );
}
