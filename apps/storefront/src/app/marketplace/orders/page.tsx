import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { OrdersPage } from '@/features/marketplace/orders/components/orders-page';

export const metadata: Metadata = { title: 'طلباتي | وفّرلي' };

export default function MarketplaceOrdersPage() {
  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <OrdersPage />
      <MarketplaceFooter />
    </>
  );
}
