'use client';

import { filterProducts } from '@/features/marketplace/catalog/model/catalog';
import { FlashCountdown } from '@/features/marketplace/catalog/components/flash-countdown';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import Link from 'next/link';

export function MarketplaceProducts({
  category,
  term,
  onAdded,
}: {
  category: string;
  term: string;
  onAdded: () => void;
}) {
  const products = filterProducts(category, term);
  return (
    <section
      className={'section deal-panel mt-7 bg-white rounded-[20px] p-5 [box-shadow:var(--shadow)]'}
      id="deals"
    >
      <div className={'deal-top flex items-center gap-3 mb-[17px]'}>
        <span
          className={
            'deal-title bg-destructive text-[#fff] py-[9px] px-3.5 rounded-[10px] font-black'
          }
        >
          عروض خاطفة
        </span>
        <strong>تنتهي خلال</strong>
        <FlashCountdown />
        <Link className={'more text-accent font-extrabold no-underline text-[13px] mr-auto'} href="/marketplace/offers">
          عرض الكل ←
        </Link>
      </div>
      <div
        className={
          'products grid grid-cols-5 gap-3.5 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:overflow-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2'
        }
      >
        {products.map((p) => (
          <ProductCard product={p} key={p.id} onAdded={onAdded} />
        ))}
      </div>
      {products.length === 0 && (
        <div className={'text-center p-[35px] text-muted-foreground'}>
          لا توجد منتجات مطابقة لبحثك.
        </div>
      )}
    </section>
  );
}
