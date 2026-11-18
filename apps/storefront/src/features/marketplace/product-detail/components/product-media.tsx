import { cn } from '@waffarly/ui';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { FavoriteButton } from '@/features/marketplace/favorites/components/favorite-button';

export function ProductMedia({ product }: { product: MarketplaceProduct }) {
  return (
    <div
      className={cn(
        'detail-media relative min-w-0 [align-self:start] rounded-[18px] overflow-hidden bg-[var(--purple-50)] [&_>_img]:block',
        '[&_>_img]:w-full [&_>_img]:h-[clamp(340px,_34vw,_480px)] [&_>_img]:object-contain max-[900px]:[&_>_img]:h-95 max-[700px]:[&_>_img]:h-80',
      )}
    >
      <img {...product.image} />
      <span
        className={cn(
          'discount absolute top-2.5 right-[10px] bg-destructive text-[#fff] rounded-[8px] py-1.5',
          'px-2 text-[11px] font-black',
        )}
      >
        {product.origin === 'local-mock' ? 'مثال تجريبي' : product.discount}
      </span>
      <FavoriteButton productId={product.id} name={product.cartName} product={product} />
    </div>
  );
}
