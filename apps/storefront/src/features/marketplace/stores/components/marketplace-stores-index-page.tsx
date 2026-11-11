'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { MarketplaceStoreCard } from '@/features/marketplace/stores/components/marketplace-store-card';
import data from '@/features/marketplace/data/reference.json';

export function MarketplaceStoresIndexPage() {
  const [term, setTerm] = useState('');
  const stores = useMemo(
    () => data.stores.filter((store) => `${store.name} ${store.description}`.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase())),
    [term],
  );

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
            <span aria-current="page">كل المتاجر</span>
          </nav>
          <h1 className="sr-only">كل المتاجر</h1>
          <div className="mb-5 mt-0 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-bold text-accent">اكتشف بائعين وفّـرلي</p>
              <p className="mb-0 mt-0.5 text-sm text-muted-foreground">
                تصفّح المتاجر المتاحة في بيانات السوق الحالية.
              </p>
            </div>
            <label className="grid w-full gap-2 text-sm font-bold text-primary sm:w-[min(100%,_360px)]">
              ابحث عن متجر
              <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="اسم المتجر أو نشاطه"
                className="min-h-12 rounded-xl border border-border bg-white px-4 outline-none focus:border-accent"
              />
            </label>
          </div>
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">{stores.length} متجر</p>
          {stores.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stores.map((store) => <MarketplaceStoreCard key={store.name} store={store} />)}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-white p-8 text-center text-muted-foreground">ملقيناش متجر بالاسم ده. جرّب كلمة تانية.</p>
          )}
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
    </>
  );
}
