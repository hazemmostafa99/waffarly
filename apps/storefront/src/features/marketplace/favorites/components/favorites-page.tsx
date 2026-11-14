'use client';

import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import { FavoritesEmptyState } from '@/features/marketplace/favorites/components/favorites-empty-state';
import { useFavoritesStore } from '@/features/marketplace/favorites/hooks/use-favorites-store';
import { favoriteProducts } from '@/features/marketplace/favorites/model/favorites';

export function FavoritesPage({ embedded = false }: { embedded?: boolean }) {
  const Root = embedded ? 'section' : 'main';
  const Container = embedded ? 'div' : MarketplaceContainer;
  const favoriteIds = useFavoritesStore((state) => state.favorites);
  const snapshots = useFavoritesStore((state) => state.favoriteSnapshots);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const products = favoriteProducts(favoriteIds, snapshots);
  const missingIds = favoriteIds.filter((id) => !products.some((product) => product.id === id));

  return (
    <Root
      id={embedded ? undefined : 'marketplace-main'}
      className={embedded ? 'min-w-0' : 'min-h-[60vh] pb-16 pt-6'}
    >
      <Container>
        {!embedded && (
          <nav
            aria-label="مسار التنقل"
            className="mb-3 flex items-center gap-2.5 text-[12px] text-muted-foreground"
          >
            <Link className="text-accent no-underline" href="/">
              الرئيسية
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">المفضلة</span>
          </nav>
        )}
        <h1 className="sr-only">المفضلة</h1>
        {favoriteIds.length > 0 && (
          <p className="mb-3 mt-0 text-[11px] leading-5 text-muted-foreground">
            محفوظة على المتصفح. راجع السعر والتوفر من صفحة الصنف.
          </p>
        )}
        {favoriteIds.length === 0 ? (
          <FavoritesEmptyState />
        ) : (
          <section aria-label="المفضلة">
            <div
              className={
                embedded
                  ? 'grid grid-cols-1 gap-3 min-[500px]:grid-cols-2'
                  : 'grid grid-cols-5 gap-3.5 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:gap-3 max-[700px]:overflow-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2'
              }
            >
              {missingIds.map((id) => (
                <div key={id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-sm">الصنف المحفوظ مش متاح للعرض حاليًا.</p>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(id)}
                    className="text-sm font-bold text-destructive"
                  >
                    إزالة من المفضلة
                  </button>
                </div>
              ))}
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </Root>
  );
}
