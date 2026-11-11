import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketplaceOffersPage } from '@/features/marketplace/catalog/components/marketplace-offers-page';

export const metadata: Metadata = { title: 'كل العروض | وفّرلي' };

export default function MarketplaceOffersRoute() {
  return <Suspense fallback={<main className="marketplace-container p-8">جارٍ تحميل العروض…</main>}><MarketplaceOffersPage /></Suspense>;
}
