import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { OrderTrackingPage } from '@/features/marketplace/orders/components/order-tracking-page';

export const metadata: Metadata = { title: 'تتبع الطلب التجريبي | وفّرلي' };

export default async function MarketplaceOrderTrackingRoute({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <OrderTrackingPage orderId={orderId} />
      <MarketplaceFooter />
    </>
  );
}
