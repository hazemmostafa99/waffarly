import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSkeleton } from '@/features/marketplace/shared/components/marketplace-skeleton';

export function MerchantEntrySkeleton() {
  return (
    <div
      className="marketplace-theme min-h-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">جارٍ تحميل صفحة تقديم التاجر…</span>
      <MarketplaceHeaderSkeleton announce={false} />
      <main className="pb-12">
        <MarketplaceContainer className="max-w-[760px]">
          <MarketplaceSkeleton className="my-4 h-4 w-28" />
          <section className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:p-5">
            <MarketplaceSkeleton className="h-6 w-48" />
            <MarketplaceSkeleton className="mb-2 h-3 w-64 max-w-full" />
            <MarketplaceSkeleton className="h-11 w-full rounded-lg" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="grid gap-2">
                  <MarketplaceSkeleton className="h-3 w-28" />
                  <MarketplaceSkeleton className="h-11 w-full rounded-lg" />
                </div>
              ))}
            </div>
            <MarketplaceSkeleton className="h-11 w-full rounded-lg" />
          </section>
        </MarketplaceContainer>
      </main>
    </div>
  );
}
