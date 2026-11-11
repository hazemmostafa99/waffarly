import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketplaceOffersPage } from '@/features/marketplace/catalog/components/marketplace-offers-page';
import { MarketplaceOffersSkeleton } from '@/features/marketplace/catalog/components/marketplace-offers-skeleton';

export const metadata: Metadata = { title: 'كل العروض | وفّرلي' };

export default function MarketplaceOffersRoute() {
  return (
    <Suspense fallback={<MarketplaceOffersSkeleton />}>
      <MarketplaceOffersPage />
    </Suspense>
  );
}
