import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketplaceStoresIndexPage } from '@/features/marketplace/stores/components/marketplace-stores-index-page';
import { MarketplaceStoresSkeleton } from '@/features/marketplace/stores/components/marketplace-stores-skeleton';

export const metadata: Metadata = { title: 'كل المتاجر | وفّرلي' };

export default function MarketplaceStoresPage() {
  return (
    <Suspense fallback={<MarketplaceStoresSkeleton />}>
      <MarketplaceStoresIndexPage />
    </Suspense>
  );
}
