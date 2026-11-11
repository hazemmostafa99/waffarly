import { cn } from '@waffarly/ui';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { ProductPrice } from '@/features/marketplace/catalog/components/product-price';
import { ProductRating } from '@/features/marketplace/catalog/components/product-rating';
import { ProductSellerCard } from '@/features/marketplace/product-detail/components/product-seller-card';

export function ProductInfo({ product }: { product: MarketplaceProduct }) {
  return (
    <>
      <p
        className={cn(
          'detail-demo inline-block mt-0 mx-0 mb-3.5 rounded-[8px] py-1.5 px-2.5',
          'bg-secondary text-accent text-[11px]',
        )}
      >
        تجربة محلية — بيانات النموذج
      </p>
      <h1>{product.name}</h1>
      <ProductRating rating={product.rating} />
      <div
        className={
          'detail-price-block flex items-center gap-4 flex-wrap mt-2 mx-0 mb-4 [&_.price-row]:m-0'
        }
      >
        <ProductPrice product={product} />
        <span
          className={
            'detail-saving bg-secondary text-accent rounded-[6px] py-[5px] px-2 text-[12px] font-bold'
          }
        >
          خصم {product.discount.replace('-', '')}
        </span>
      </div>
      <ProductSellerCard product={product} />
    </>
  );
}
