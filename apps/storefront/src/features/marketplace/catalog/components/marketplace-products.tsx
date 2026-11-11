'use client';

import { filterProducts } from '@/features/marketplace/catalog/model/catalog';
import { MarketplaceOffersSection } from '@/features/marketplace/catalog/components/marketplace-offers-section';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import { SectionHeading } from '@/components/marketplace/section-heading';

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
    <>
      <section
        className="section product-panel mt-7 rounded-[20px] bg-white p-5 [box-shadow:var(--shadow)]"
        id="products"
      >
        <SectionHeading
          title="منتجات السوق"
          subtitle="تصفّح المنتجات المتاحة، واستخدم البحث والتصفية للوصول لما تريده."
          more="كل المنتجات"
          moreHref="/products"
        />
        <div className="products grid grid-cols-5 gap-3.5 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:overflow-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2">
          {products.map((product) => (
            <ProductCard
              product={product}
              key={product.id}
              onAdded={onAdded}
              homeSection="products"
            />
          ))}
        </div>
        {products.length === 0 && (
          <div className="p-[35px] text-center text-muted-foreground">
            لا توجد منتجات مطابقة لبحثك.
          </div>
        )}
      </section>
      <MarketplaceOffersSection category={category} term={term} onAdded={onAdded} />
    </>
  );
}
