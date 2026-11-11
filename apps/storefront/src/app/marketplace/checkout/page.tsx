import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '@/features/marketplace/components/navigation/marketplace-site-header';
import { MarketplaceFooter } from '@/features/marketplace/components/navigation/marketplace-footer';
import { CheckoutPage } from '@/features/marketplace/components/checkout/checkout-page';

export const metadata: Metadata = { title: 'إتمام الطلب التجريبي | وفّرلي' };

export default function MarketplaceCheckoutPage() {
  return <><Suspense fallback={<div className="top header-loading" aria-busy="true" />}><MarketplaceSiteHeader /></Suspense><CheckoutPage /><MarketplaceFooter /></>;
}
