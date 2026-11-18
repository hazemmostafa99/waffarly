import Link from 'next/link';
import { cn } from '@waffarly/ui';
import { ProductCard } from '@/features/marketplace/catalog/components/product-card';
import { FlashCountdown } from '@/features/marketplace/catalog/components/flash-countdown';
import { filterProducts } from '@/features/marketplace/catalog/model/catalog';

export function MarketplaceOffersSection({
  category,
  term,
  onAdded,
}: {
  category: string;
  term: string;
  onAdded?: () => void;
}) {
  const offers = filterProducts(category, term)
    .filter((product) => Boolean(product.oldPrice?.trim()))
    .slice(0, 5);

  return (
    <section
      id="deals"
      aria-labelledby="marketplace-offers-heading"
      className="section mt-5 rounded-[20px] bg-white p-5 [box-shadow:var(--shadow)]"
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="marketplace-offers-heading"
            className="m-0 text-2xl font-black leading-tight text-primary"
          >
            عروض اليوم
          </h2>
          <p className="mb-0 mt-1.5 text-[13px] text-muted-foreground">
            منتجات مخفّضة من بيانات السوق المتاحة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
            <span className="text-xs font-bold text-primary">تنتهي خلال</span>
            <FlashCountdown />
          </div>
          <Link
            href="/offers"
            className={cn(
              'rounded-xl bg-waffarly-gold px-4 py-2.5 text-xs font-black text-primary no-underline',
              'transition-colors hover:bg-[#ffd353] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            عرض كل العروض ←
          </Link>
        </div>
      </header>

      {offers.length > 0 ? (
        <div className="grid grid-cols-5 gap-3.5 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:overflow-x-auto max-[700px]:[scroll-snap-type:x_mandatory] max-[700px]:pb-2">
          {offers.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              {...(onAdded ? { onAdded } : {})}
              homeSection="deals"
            />
          ))}
        </div>
      ) : (
        <p className="m-0 rounded-xl bg-secondary p-6 text-center text-sm text-muted-foreground">
          مفيش عروض مطابقة للبحث الحالي.
        </p>
      )}
    </section>
  );
}
