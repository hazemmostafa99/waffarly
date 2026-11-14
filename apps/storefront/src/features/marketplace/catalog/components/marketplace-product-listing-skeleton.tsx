import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSkeleton } from '@/features/marketplace/shared/components/marketplace-skeleton';

export function MarketplaceProductListingSkeleton({ label = 'المنتجات' }: { label?: string }) {
  return (
    <div
      className="marketplace-theme min-h-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">جارٍ تحميل {label}…</span>
      <MarketplaceHeaderSkeleton announce={false} />
      <main className="pb-16">
        <MarketplaceContainer>
          <MarketplaceSkeleton className="mb-3 mt-5 h-3 w-40" />
          <header className="mb-3 mt-0 grid gap-2">
            <MarketplaceSkeleton className="h-3 w-28" />
            <MarketplaceSkeleton className="h-3 w-80 max-w-full" />
          </header>
          <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_190px_205px_75px]">
            <MarketplaceSkeleton className="h-10 w-full rounded-xl" />
            <MarketplaceSkeleton className="h-10 w-full rounded-xl" />
            <MarketplaceSkeleton className="h-10 w-full rounded-xl" />
            <MarketplaceSkeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-3 max-[700px]:flex max-[700px]:overflow-hidden">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white p-2.5 shadow-[var(--shadow)] max-[700px]:min-w-[210px]"
              >
                <MarketplaceSkeleton className="h-40 w-full rounded-xl sm:h-48" />
                <div className="grid gap-2 p-1 pt-3">
                  <MarketplaceSkeleton className="h-3 w-20" />
                  <MarketplaceSkeleton className="h-4 w-full" />
                  <MarketplaceSkeleton className="h-4 w-3/4" />
                  <MarketplaceSkeleton className="h-4 w-24" />
                  <MarketplaceSkeleton className="mt-1 h-9 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </MarketplaceContainer>
      </main>
    </div>
  );
}
