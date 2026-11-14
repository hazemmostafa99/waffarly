'use client';

import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import type { MarketplaceStore } from '@/features/marketplace/stores/model/stores';

export function StoreDetailPage({
  store,
  products,
}: {
  store: MarketplaceStore;
  products: MarketplaceProduct[];
}) {

  return (
    <main id="marketplace-main" tabIndex={-1} className="min-h-[60vh] pb-16 pt-6">
      <MarketplaceContainer>
        <nav
          aria-label="مسار التنقل"
          className="mb-6 flex items-center gap-2.5 text-[12px] text-muted-foreground"
        >
          <Link className="text-accent no-underline" href="/">
            الرئيسية
          </Link>
          <span aria-hidden="true">/</span>
          <Link className="text-accent no-underline" href="/#stores">
            المتاجر
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{store.name}</span>
        </nav>
        <header className="mb-7 flex flex-wrap items-center gap-5 rounded-[20px] border border-solid border-border bg-card p-6 shadow-[var(--shadow)] max-[700px]:p-4">
          <img
            className="size-24 rounded-[18px] border border-solid border-border object-cover max-[700px]:size-20"
            src={store.image.src}
            alt={store.image.alt}
          />
          <div className="min-w-0 flex-1">
            <span className="mb-2 inline-block rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold text-accent">
              متجر من بيانات العرض المحلية
            </span>
            <h1 className="mb-2 mt-0 text-[28px] leading-[1.4] max-[700px]:text-[23px]">
              {store.name}
            </h1>
            <p className="m-0 text-[13px] leading-[1.8] text-muted-foreground">
              {store.description}
            </p>
          </div>
        </header>
        <section aria-labelledby="store-products-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="store-products-title" className="mb-1 mt-0 text-[22px]">
                منتجات المتجر
              </h2>
              <p className="m-0 text-[12px] text-muted-foreground">
                منتجات المرجع مع أمثلة محلية معلّمة بوضوح.
              </p>
            </div>
            <span className="whitespace-nowrap rounded-lg bg-secondary px-2.5 py-[7px] text-[11px] text-accent">
              {products.length} {products.length === 1 ? 'منتج' : 'منتجات'}
            </span>
          </div>
          {products.some((product) => product.origin === 'local-mock') && (
            <p className="mb-5 mt-0 rounded-[10px] bg-secondary px-4 py-3 text-[12px] leading-[1.8] text-accent">
              البطاقات المعلّمة «مثال تجريبي» أُضيفت لشرح شكل المتجر فقط، ومش بيانات أصلية للبائع.
            </p>
          )}
          {products.length ? (
            <div className="grid grid-cols-5 gap-3.5 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:gap-3 max-[700px]:overflow-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-solid border-border bg-card p-8 text-center">
              <h3 className="mb-2 mt-0 text-[18px]">
                مفيش منتجات مسجلة للمتجر ده في بيانات العرض الحالية
              </h3>
              <p className="m-0 text-[12px] leading-[1.8] text-muted-foreground">
                مفيش منتجات مرجعية أو أمثلة محلية مضافة لهذا المتجر حاليًا.
              </p>
            </div>
          )}
        </section>
      </MarketplaceContainer>
    </main>
  );
}
