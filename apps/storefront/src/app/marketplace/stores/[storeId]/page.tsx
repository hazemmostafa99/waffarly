import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { StoreDetailPage } from '@/features/marketplace/stores/components/store-detail-page';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { findStore, productsForStore } from '@/features/marketplace/stores/model/stores';

type Props = { params: Promise<{ storeId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = findStore((await params).storeId);
  return { title: store ? `${store.name} | وفّرلي` : 'المتجر غير موجود | وفّرلي' };
}

export default async function MarketplaceStorePage({ params }: Props) {
  const store = findStore((await params).storeId);
  if (!store) notFound();

  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <Suspense
        fallback={
          <main id="marketplace-main" className="min-h-[60vh] p-8" aria-busy="true">
            جارٍ تحميل منتجات المتجر…
          </main>
        }
      >
        <StoreDetailPage store={store} products={productsForStore(store)} />
      </Suspense>
      <MarketplaceFooter />
    </>
  );
}
