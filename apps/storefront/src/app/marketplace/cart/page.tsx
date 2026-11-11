import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { CartReviewPage } from '@/features/marketplace/cart/components/cart-review-page';

export const metadata: Metadata = { title: 'سلة التسوق | وفّرلي' };

export default function CartPage() {
  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <CartReviewPage />
      <MarketplaceFooter />
    </>
  );
}
