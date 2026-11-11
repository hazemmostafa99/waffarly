import { MarketplaceHome } from '@/features/marketplace/home/components/marketplace-home';
import { Suspense } from 'react';

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <main
          id="marketplace-main"
          className={
            'marketplace-container pb-20 w-[min(1480px,_calc(100%_-_32px))] m-auto max-[700px]:w-[min(100%_-_20px,_1480px)]'
          }
          aria-busy="true"
        >
          جارٍ تجهيز المتجر…
        </main>
      }
    >
      <MarketplaceHome />
    </Suspense>
  );
}
