import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSkeleton } from '@/features/marketplace/shared/components/marketplace-skeleton';

export function MerchantEntrySkeleton() {
  return (
    <div className="marketplace-theme min-h-screen" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">جارٍ تحميل صفحة تقديم التاجر…</span>
      <MarketplaceHeaderSkeleton announce={false} />
      <main className="pb-12">
        <MarketplaceContainer>
          <div className="flex justify-end py-3">
            <MarketplaceSkeleton className="h-3.5 w-28" />
          </div>
          <section className="rounded-2xl bg-primary px-4 py-4 sm:px-6 sm:py-5">
            <MarketplaceSkeleton className="h-5 w-36 bg-white/20" />
            <MarketplaceSkeleton className="mt-3 h-7 w-64 max-w-full bg-white/20 sm:h-8 sm:w-80" />
            <MarketplaceSkeleton className="mt-2 h-3 w-80 max-w-full bg-white/15" />
          </section>
          <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.36fr)] sm:mt-4 sm:gap-4">
            <section className="grid gap-4 rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow)] sm:p-6">
              <div className="grid gap-3 border-b border-border pb-4">
                <MarketplaceSkeleton className="h-3 w-28" />
                <MarketplaceSkeleton className="h-5 w-56 max-w-full" />
                <MarketplaceSkeleton className="h-3 w-72 max-w-full" />
              </div>
              <MarketplaceSkeleton className="h-11 w-full rounded-lg" />
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="grid gap-2">
                    <MarketplaceSkeleton className="h-3 w-28" />
                    <MarketplaceSkeleton className="h-11 w-full rounded-lg" />
                  </div>
                ))}
              </div>
              <MarketplaceSkeleton className="h-11 w-full rounded-lg sm:w-48" />
            </section>
            <aside className="grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow)] sm:p-5">
              <MarketplaceSkeleton className="h-4 w-32" />
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <MarketplaceSkeleton className="size-7 rounded-full" />
                  <MarketplaceSkeleton className="h-3 w-40 max-w-[80%]" />
                </div>
              ))}
              <MarketplaceSkeleton className="h-20 w-full rounded-xl" />
            </aside>
          </div>
        </MarketplaceContainer>
      </main>
    </div>
  );
}
