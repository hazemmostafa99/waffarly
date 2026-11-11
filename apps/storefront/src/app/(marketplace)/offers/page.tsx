import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketplaceOffersPage } from '@/features/marketplace/catalog/components/marketplace-offers-page';
import { MarketplaceProductListingSkeleton } from '@/features/marketplace/catalog/components/marketplace-product-listing-skeleton';

export const metadata: Metadata = { title: 'كل العروض | وفّرلي' };

export default function MarketplaceOffersRoute() {
  return (
    <Suspense fallback={<MarketplaceProductListingSkeleton label="العروض" />}>
      <MarketplaceOffersPage />
    </Suspense>
  );
}
