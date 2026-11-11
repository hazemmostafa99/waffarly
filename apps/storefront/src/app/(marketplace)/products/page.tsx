import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketplaceProductListingPage } from '@/features/marketplace/catalog/components/marketplace-product-listing-page';
import { MarketplaceProductListingSkeleton } from '@/features/marketplace/catalog/components/marketplace-product-listing-skeleton';

export const metadata: Metadata = { title: 'كل المنتجات | وفّرلي' };

export default function MarketplaceProductsRoute() {
  return (
    <Suspense fallback={<MarketplaceProductListingSkeleton />}>
      <MarketplaceProductListingPage mode="all" />
    </Suspense>
  );
}
