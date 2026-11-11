import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import type { MarketplaceProduct } from '../../model/catalog';
import { Suspense } from 'react';
import { MarketplaceSiteHeader } from '../navigation/marketplace-site-header';
import { ProductBreadcrumbs } from './product-breadcrumbs';
import { ProductMedia } from './product-media';
import { ProductInfo } from './product-info';
import { ProductPurchase } from './product-purchase';
import { ProductRecommendations } from './product-recommendations';
import { MarketplaceFooter } from '../navigation/marketplace-footer';

export function ProductDetailPage({
  product,
  backHref,
}: {
  product: MarketplaceProduct;
  backHref: string;
}) {
  return (
    <>
      <Suspense fallback={<div className="top header-loading" aria-busy="true" />}>
        <MarketplaceSiteHeader />
      </Suspense>
      <main id="marketplace-main" tabIndex={-1}>
        <MarketplaceContainer>
          <ProductBreadcrumbs product={product} backHref={backHref} />
          <article className="product-detail">
            <ProductMedia product={product} />
            <div className="detail-content">
              <ProductInfo product={product} />
              <ProductPurchase product={product} key={product.id} />
            </div>
          </article>
          <Suspense fallback={null}>
            <ProductRecommendations product={product} />
          </Suspense>
        </MarketplaceContainer>
      </main>
      <MarketplaceFooter />
    </>
  );
}
