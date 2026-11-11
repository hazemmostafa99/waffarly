'use client';

import Link from '../../components/storefront/storefront-link';
import { Heart } from 'lucide-react';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { Button } from '@waffarly/ui';
import { useLocale } from '@waffarly/ui';
import { storefrontCopy } from '../../lib/storefront-copy';
import { useStorefrontStore } from '../../providers/storefront-providers';
import { StorefrontProductGrid } from '../catalog/storefront-product-grid';

export function StorefrontFavoritesPage({ catalog }: { catalog: PublicStorefrontCatalog }) {
  const { locale } = useLocale();
  const t = storefrontCopy(locale);
  const favoriteIds = useStorefrontStore((state) => state.favorites);
  const hasHydrated = useStorefrontStore((state) => state.hasHydrated);
  const products = catalog.products.filter((product) => favoriteIds.includes(product.id));

  if (!hasHydrated) {
    return <main id="main-content" className="mx-auto min-h-[65vh] max-w-[1100px] px-4 py-10 sm:px-8"><div className="h-72 animate-pulse rounded-3xl bg-white" /></main>;
  }

  return (
    <main id="main-content" className="mx-auto min-h-[65vh] max-w-[1100px] px-4 pb-10 pt-6 sm:px-8 sm:pt-8">
      <header className="mb-5">
        <p className="text-storefront-support font-extrabold text-store-accent">{catalog.merchantName}</p>
        <h1 className="mt-1 font-heading text-storefront-page font-black text-store-ink">{t.favoritesTitle}</h1>
        <p className="mt-1 text-storefront-body text-store-muted">{t.favoritesIntro}</p>
      </header>
      {products.length ? (
        <StorefrontProductGrid products={products} slug={catalog.slug} />
      ) : (
        <div className="grid min-h-72 place-items-center rounded-[1.6rem] border border-dashed border-store-border bg-white px-6 text-center">
          <div>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-store-cream text-store-gold-muted"><Heart className="size-7" aria-hidden="true" /></span>
            <p className="mt-3 font-heading text-storefront-subsection font-extrabold text-store-ink">{t.favoritesEmpty}</p>
            <Button asChild className="mt-4 rounded-xl bg-store-accent px-5 font-bold hover:bg-store-primary-dark"><Link href={`/s/${catalog.slug}/menu`}>{t.exploreFavorites}</Link></Button>
          </div>
        </div>
      )}
    </main>
  );
}
