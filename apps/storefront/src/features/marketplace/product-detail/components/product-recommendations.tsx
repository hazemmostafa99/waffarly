'use client';

import { cn } from '@waffarly/ui';

import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { productRecommendations } from '@/features/marketplace/product-detail/model/product-recommendations';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';

export function ProductRecommendations({ product }: { product: MarketplaceProduct }) {
  const products = productRecommendations(product);
  if (!products.length) return null;
  const hasRelated = products.some((item) => item.category === product.category);
  return (
    <section
      className={cn(
        'product-recommendations max-w-310 mt-8 mx-auto mb-0 [&_.products]:grid [&_.products]:grid-cols-4 [&_.products]:gap-4',
        'max-[1024px]:[&_.products]:grid-cols-2 max-[700px]:[&_.products]:flex max-[700px]:[&_.products]:gap-3 max-[700px]:[&_.products]:overflow-auto max-[700px]:[&_.products]:[scroll-snap-type:x_mandatory] max-[700px]:[&_.products]:pb-2 max-[700px]:[&_.section-head_h2]:text-[21px]',
      )}
      aria-labelledby="recommendations-title"
    >
      <div
        className={cn(
          'section-head flex items-end justify-between gap-[15px] mb-3.5 [&_h2]:text-[24px] [&_h2]:m-0',
          '[&_p]:text-muted-foreground [&_p]:text-[13px] [&_p]:mt-1.5 [&_p]:mx-0 [&_p]:mb-0',
        )}
      >
        <div>
          <h2 id="recommendations-title">{hasRelated ? 'منتجات قد تعجبك' : 'اكتشف منتجات أخرى'}</h2>
          <p>
            {hasRelated
              ? 'اختيارات من نفس القسم، ومعاها منتجات من أقسام أخرى.'
              : 'اختيارات من الأقسام الأخرى المتاحة للتصفح.'}
          </p>
        </div>
      </div>
      <div
        className={
          'products grid grid-cols-5 gap-3.5 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:overflow-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2'
        }
      >
        {products.map((item) => (
          <div
            className={
              'recommendation-entry min-w-0 max-[700px]:[flex:0_0_220px] max-[700px]:[scroll-snap-align:start]'
            }
            key={item.id}
          >
            <span
              className={cn(
                `recommendation-label${item.category === product.category ? ' related' : ''}`,
                'inline-block mb-2 py-[5px] px-2 rounded-[6px] bg-card text-muted-foreground text-[10px] [&.related]:bg-secondary [&.related]:text-accent',
              )}
            >
              {item.category === product.category ? 'من نفس القسم' : 'من قسم آخر'}
            </span>
            <ProductCard product={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
