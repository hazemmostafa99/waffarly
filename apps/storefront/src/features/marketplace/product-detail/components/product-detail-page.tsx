import { cn } from '@waffarly/ui';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '@/features/marketplace/navigation/components/marketplace-site-header';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { ProductBreadcrumbs } from '@/features/marketplace/product-detail/components/product-breadcrumbs';
import { ProductMedia } from '@/features/marketplace/product-detail/components/product-media';
import { ProductInfo } from '@/features/marketplace/product-detail/components/product-info';
import { ProductPurchase } from '@/features/marketplace/product-detail/components/product-purchase';
import { ProductRecommendations } from '@/features/marketplace/product-detail/components/product-recommendations';
import { MarketplaceFooter } from '@/features/marketplace/navigation/components/marketplace-footer';
import { RestaurantProductDetail } from './restaurant-product-detail';

export function ProductDetailPage({
  product,
  backHref,
}: {
  product: MarketplaceProduct;
  backHref: string;
}) {
  return (
    <>
      <Suspense fallback={<MarketplaceHeaderSkeleton />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <main id="marketplace-main" tabIndex={-1} className={'pb-20'}>
        <MarketplaceContainer>
          <ProductBreadcrumbs product={product} backHref={backHref} />
          {product.merchantType === 'restaurant' ? <RestaurantProductDetail product={product} /> : <>
          <article
            className={cn(
              'product-detail grid grid-cols-[minmax(0,_1fr)_minmax(0,_1.1fr)] gap-9 max-w-310 mt-0 mx-auto mb-8',
              'p-7 bg-card border border-solid border-border rounded-[24px] [box-shadow:var(--shadow)] max-[700px]:grid-cols-[1fr]',
              'max-[700px]:gap-5 max-[700px]:p-4 max-[700px]:rounded-[18px] max-[900px]:gap-5.5 max-[900px]:p-5',
            )}
          >
            <ProductMedia product={product} />
            <div
              className={
                'detail-content min-w-0 [&_h1]:text-[clamp(24px,_2.1vw,_30px)] [&_h1]:leading-[1.5] [&_h1]:mt-0 [&_h1]:mx-0 [&_h1]:mb-3 [&_.price]:text-[28px] max-[700px]:[&_h1]:text-[24px]'
              }
            >
              <ProductInfo product={product} />
              <ProductPurchase product={product} key={product.id} />
            </div>
          </article>
          <Suspense fallback={null}>
            <ProductRecommendations product={product} />
          </Suspense>
          </>}
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
    </>
  );
}
