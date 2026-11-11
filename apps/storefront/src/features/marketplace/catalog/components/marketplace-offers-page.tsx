'use client';

import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import data from '@/features/marketplace/data/reference.json';

const offers = data.products.filter((product) => Boolean(product.oldPrice?.trim()));

export function MarketplaceOffersPage() {
  return (
    <>
      <MarketplaceSiteHeader />
      <main id="marketplace-main" tabIndex={-1} className="pb-20">
        <MarketplaceContainer>
          <nav
            aria-label="مسار التنقل"
            className="mb-3 mt-5 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Link className="text-accent no-underline hover:text-primary" href="/marketplace">
              الرئيسية
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">كل العروض</span>
          </nav>
          <h1 className="sr-only">كل العروض</h1>
          <header className="mb-3 mt-0">
            <p className="mb-1 text-xs font-bold text-accent">وفر على اختياراتك</p>
            <p className="mb-0 mt-0.5 text-sm text-muted-foreground">
              العروض هنا مبنية على المنتجات التي تحتوي بياناتها المحلية على سعر سابق.
            </p>
          </header>
          <p className="mb-4 text-sm text-muted-foreground">{offers.length} عروض</p>
          {offers.length ? (
            <div className="grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:overflow-x-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2">
              {offers.map((product) => <ProductCard key={product.id} product={product} onAdded={() => undefined} />)}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-white p-8 text-center text-muted-foreground">مفيش عروض متاحة في البيانات الحالية.</p>
          )}
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
    </>
  );
}
