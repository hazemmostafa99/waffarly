'use client';

import { cn } from '@waffarly/ui';

import { MarketplaceButton as Button } from '@/components/marketplace/marketplace-button';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { productHref } from '@/features/marketplace/product-detail/model/product-navigation';
import { ProductPrice } from '@/features/marketplace/catalog/components/product-price';
import { ProductRating } from '@/features/marketplace/catalog/components/product-rating';
import { FavoriteButton } from '@/features/marketplace/favorites/components/favorite-button';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { MAX_CART_QUANTITY } from '@/features/marketplace/cart/model/cart';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';

export function ProductCard({
  product: p,
  onAdded,
}: {
  product: MarketplaceProduct;
  onAdded: () => void;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const href = productHref(p.id, params.toString(), pathname ?? '');
  const addToCart = useCartStore((s) => s.addToCart);
  const atLimit = useCartStore(
    (s) => (s.cart.find((line) => line.productId === p.id)?.quantity ?? 0) >= MAX_CART_QUANTITY,
  );
  return (
    <article
      className={cn(
        'product bg-white border border-solid border-border rounded-[16px] overflow-hidden relative',
        '[transition:0.2s] min-w-0 hover:[transform:translateY(-4px)] hover:[box-shadow:var(--shadow)] [&:hover_.product-image_img]:[transform:scale(1.045)] [&_h3]:text-[13px] [&_h3]:leading-[1.6] [&_h3]:h-10.5',
        '[&_h3]:overflow-hidden [&_h3]:mt-0 [&_h3]:mx-0 [&_h3]:mb-2 max-[700px]:min-w-55 max-[700px]:[scroll-snap-align:start] [&_h3_a]:text-inherit [&_h3_a]:no-underline',
        '[&_h3_a:hover]:underline',
      )}
    >
      <div
        className={cn(
          'product-image h-[205px] bg-[#f7f6f8] relative overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover',
          '[&_img]:[transition:0.3s] max-[700px]:h-45 [&_>_a]:block [&_>_a]:h-full',
        )}
      >
        <Link href={href} aria-label={p.name}>
          <img {...p.image} loading="lazy" />
        </Link>
        <span
          className={cn(
            'discount absolute top-2.5 right-[10px] bg-destructive text-[#fff] rounded-[8px] py-1.5',
            'px-2 text-[11px] font-black',
          )}
        >
          {p.origin === 'local-mock' ? 'مثال تجريبي' : p.discount}
        </span>
        <FavoriteButton productId={p.id} name={p.cartName} />
      </div>
      <div className={'product-body p-[13px]'}>
        <div
          className={
            'seller flex items-center gap-1.5 text-accent text-[10px] font-extrabold mb-[7px]'
          }
        >
          {!p.origin && (
            <span
              className={
                'verified bg-accent text-[#fff] rounded-full w-[15px] h-[15px] inline-grid place-items-center text-[9px]'
              }
            >
              ✓
            </span>
          )}
          {p.seller.replace('✓', '').trim()}
        </div>
        <h3>
          <Link href={href}>{p.name}</Link>
        </h3>
        <ProductRating rating={p.rating} demo={p.origin === 'local-mock'} />
        <ProductPrice product={p} />
        <div className={'delivery text-success text-[10px] font-extrabold'}>{p.delivery}</div>
        <Button
          className={cn(
            'add disabled:cursor-not-allowed disabled:opacity-[0.5] w-full border-0 rounded-[9px] bg-waffarly-gold text-[#30113a]',
            'p-2.5 font-black mt-2.5 hover:bg-[#ffd353]',
          )}
          disabled={atLimit}
          onClick={() => {
            if (addToCart(p.id)) onAdded();
          }}
        >
          أضف للسلة
        </Button>
      </div>
    </article>
  );
}
