import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { OrderDetailPage } from '@/features/marketplace/orders/components/order-detail-page';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';

export const metadata: Metadata = { title: 'تفاصيل الطلب | وفّرلي' };

export default async function MarketplaceOrderDetailPage({
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
      <OrderDetailPage orderId={orderId} />
      <MarketplaceFooter />
    </>
  );
}
