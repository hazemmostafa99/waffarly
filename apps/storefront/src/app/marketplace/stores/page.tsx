import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketplaceStoresIndexPage } from '@/features/marketplace/stores/components/marketplace-stores-index-page';

export const metadata: Metadata = { title: 'كل المتاجر | وفّرلي' };

export default function MarketplaceStoresPage() {
  return <Suspense fallback={<main className="marketplace-container p-8">جارٍ تحميل المتاجر…</main>}><MarketplaceStoresIndexPage /></Suspense>;
}
