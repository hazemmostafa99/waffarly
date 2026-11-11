import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSkeleton } from '@/features/marketplace/shared/components/marketplace-skeleton';

export function MarketplaceStoresSkeleton() {
  return (
    <div className="marketplace-theme min-h-screen" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">جارٍ تحميل المتاجر…</span>
      <MarketplaceHeaderSkeleton announce={false} />
      <main className="pb-16">
        <MarketplaceContainer>
          <div className="mb-5 mt-6 grid gap-4 sm:grid-cols-[1fr_300px] sm:items-end">
            <div className="grid gap-2">
              <MarketplaceSkeleton className="h-3 w-40" />
              <MarketplaceSkeleton className="h-8 w-44" />
              <MarketplaceSkeleton className="h-3 w-72 max-w-full" />
            </div>
            <MarketplaceSkeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex min-h-28 items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow)]">
                <MarketplaceSkeleton className="size-[68px] shrink-0 rounded-2xl" />
                <div className="grid min-w-0 flex-1 gap-2">
                  <MarketplaceSkeleton className="h-4 w-32 max-w-full" />
                  <MarketplaceSkeleton className="h-3 w-48 max-w-full" />
                  <MarketplaceSkeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        </MarketplaceContainer>
      </main>
    </div>
  );
}
