import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { CheckoutPage } from '@/features/marketplace/checkout/components/checkout-page';

export const metadata: Metadata = { title: 'إتمام الطلب التجريبي | وفّرلي' };

export default function MarketplaceCheckoutPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className={'top header-loading bg-primary text-[#fff] min-h-40'} aria-busy="true" />
        }
      >
        <MarketplaceSiteHeader />
      </Suspense>
      <CheckoutPage />
      <MarketplaceFooter />
    </>
  );
}
