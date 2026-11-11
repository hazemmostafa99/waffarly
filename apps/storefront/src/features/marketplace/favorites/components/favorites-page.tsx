'use client';

import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { FavoritesEmptyState } from '@/features/marketplace/favorites/components/favorites-empty-state';
import { useFavoritesStore } from '@/features/marketplace/favorites/hooks/use-favorites-store';
import { favoriteProducts } from '@/features/marketplace/favorites/model/favorites';

export function FavoritesPage() {
  const favoriteIds = useFavoritesStore((state) => state.favorites);
  const setCartOpen = useCartStore((state) => state.setCartOpen);
  const products = favoriteProducts(favoriteIds);

  return (
    <main id="marketplace-main" className="min-h-[60vh] pb-16 pt-6">
      <MarketplaceContainer>
        <nav
          aria-label="مسار التنقل"
          className="mb-6 flex items-center gap-2.5 text-[12px] text-muted-foreground"
        >
          <Link className="text-accent no-underline" href="/marketplace">
            الرئيسية
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">المفضلة</span>
        </nav>
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 mt-0 text-[30px] leading-[1.4] max-[700px]:text-[25px]">
              المنتجات المفضلة
            </h1>
            <p className="m-0 text-[13px] leading-[1.8] text-muted-foreground">
              المنتجات اللي حفظتها عشان ترجع لها بسهولة.
            </p>
          </div>
          <span className="whitespace-nowrap rounded-lg bg-secondary px-2.5 py-[7px] text-[11px] text-accent">
            {products.length} {products.length === 1 ? 'منتج' : 'منتجات'}
          </span>
        </header>
        <p className="mb-5 mt-0 rounded-[10px] bg-secondary px-4 py-3 text-[12px] leading-[1.8] text-accent">
          القائمة مؤقتة في الجلسة الحالية، ومش محفوظة بعد تحديث الصفحة.
        </p>
        {products.length === 0 ? (
          <FavoritesEmptyState />
        ) : (
          <section aria-label="المنتجات المفضلة">
            <div className="grid grid-cols-5 gap-3.5 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:gap-3 max-[700px]:overflow-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onAdded={() => setCartOpen(true)} />
              ))}
            </div>
            <p className="mb-0 mt-4 text-[11px] leading-[1.8] text-muted-foreground">
              لإزالة منتج من القائمة، اضغط علامة القلب الموجودة على صورته.
            </p>
          </section>
        )}
      </MarketplaceContainer>
    </main>
  );
}
