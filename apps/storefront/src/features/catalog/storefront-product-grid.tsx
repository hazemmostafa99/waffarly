import type { PublicStorefrontProduct } from '@waffarly/contracts';
import { StorefrontProductCard } from './storefront-product-card';

export function StorefrontProductGrid({
  products,
  slug,
  layout = 'featured',
}: {
  products: PublicStorefrontProduct[];
  slug: string;
  layout?: 'featured' | 'menu';
}) {
  const columns = layout === 'menu'
    ? 'grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4'
    : 'grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className={`grid ${columns}`}>
      {products.map((product) => (
        <StorefrontProductCard key={product.id} product={product} slug={slug} />
      ))}
    </div>
  );
}
