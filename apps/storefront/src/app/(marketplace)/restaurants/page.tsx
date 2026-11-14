import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { RestaurantsIndexPage } from '@/features/marketplace/restaurants/components/restaurants-index-page';

export const metadata = { title: 'المطاعم | وفّرلي' };

export default function RestaurantsPage() {
  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <Suspense
        fallback={
          <p className="p-8" role="status">
            جارٍ عرض المطاعم…
          </p>
        }
      >
        <RestaurantsIndexPage />
      </Suspense>
      <MarketplaceFooter />
    </>
  );
}
