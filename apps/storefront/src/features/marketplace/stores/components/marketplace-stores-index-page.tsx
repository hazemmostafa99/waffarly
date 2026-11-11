'use client';

import { useMemo, useState } from 'react';
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
          <div className="mb-5 mt-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-bold text-accent">اكتشف بائعين وفّـرلي</p>
              <h1 className="m-0 text-3xl font-black text-primary">كل المتاجر</h1>
              <p className="mb-0 mt-2 text-sm text-muted-foreground">تصفّح المتاجر المتاحة في بيانات السوق الحالية.</p>
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
