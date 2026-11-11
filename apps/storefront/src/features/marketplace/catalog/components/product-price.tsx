import { money } from '@/features/marketplace/shared/lib/format-money';
import { type MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
export function ProductPrice({ product }: { product: MarketplaceProduct }) {
  return (
    <div className={'price-row flex [align-items:baseline] gap-[7px] my-2.5 mx-0'}>
      <span className={'price font-black text-[18px] text-primary'}>{money(product.price)}</span>
      {product.oldPrice && (
        <span className={'old text-[#999] line-through text-[11px]'}>{product.oldPrice}</span>
      )}
    </div>
  );
}
