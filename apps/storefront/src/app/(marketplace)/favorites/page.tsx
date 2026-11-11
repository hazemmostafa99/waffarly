import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { FavoritesPage } from '@/features/marketplace/favorites/components/favorites-page';

export const metadata: Metadata = { title: 'المفضلة | وفّرلي' };

export default function MarketplaceFavoritesPage() {
  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <Suspense
        fallback={
          <main id="marketplace-main" className="min-h-[60vh] p-8" aria-busy="true">
            جارٍ تحميل المنتجات المحفوظة…
          </main>
        }
      >
        <FavoritesPage />
      </Suspense>
      <MarketplaceFooter />
    </>
  );
}
