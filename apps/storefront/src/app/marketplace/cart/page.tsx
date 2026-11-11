import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '@/features/marketplace/components/navigation/marketplace-site-header';
import { MarketplaceFooter } from '@/features/marketplace/components/navigation/marketplace-footer';
import { CartReviewPage } from '@/features/marketplace/components/cart/cart-review-page';

export const metadata: Metadata = { title: 'سلة التسوق | وفّرلي' };

export default function CartPage() {
  return (
    <>
      <Suspense fallback={<div className="top header-loading" aria-busy="true" />}><MarketplaceSiteHeader /></Suspense>
      <CartReviewPage />
      <MarketplaceFooter />
    </>
  );
}
