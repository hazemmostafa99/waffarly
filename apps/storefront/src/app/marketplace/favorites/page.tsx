import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { FavoritesPage } from '@/features/marketplace/favorites/components/favorites-page';

export const metadata: Metadata = { title: 'المفضلة | وفّرلي' };

export default function MarketplaceFavoritesPage() {
  return (
    <>
      <Suspense fallback={<div className="min-h-40 bg-primary" aria-busy="true" />}>
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
