import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSkeleton } from '@/features/marketplace/shared/components/marketplace-skeleton';

export function AccountSkeleton() {
  return (
    <div
      className="marketplace-theme min-h-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">جارٍ تجهيز الحساب…</span>
      <MarketplaceHeaderSkeleton announce={false} />
      <main className="pb-16 pt-6">
        <MarketplaceContainer>
          <MarketplaceSkeleton className="mb-4 h-3.5 w-28" />
          <section className="overflow-hidden rounded-3xl border border-border bg-white shadow-[var(--shadow)]">
            <div className="bg-primary px-5 py-6 sm:px-8">
              <MarketplaceSkeleton className="h-5 w-32 bg-white/20" />
              <MarketplaceSkeleton className="mt-4 h-7 w-56 max-w-full bg-white/20" />
              <MarketplaceSkeleton className="mt-2 h-3 w-72 max-w-full bg-white/15" />
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_0.8fr] sm:p-8">
              <div className="grid content-center gap-3">
                <MarketplaceSkeleton className="h-5 w-48 max-w-full" />
                <MarketplaceSkeleton className="h-3 w-full" />
                <MarketplaceSkeleton className="h-3 w-4/5" />
              </div>
              <div className="grid gap-3 rounded-2xl bg-secondary/70 p-4">
                <MarketplaceSkeleton className="h-9 w-full rounded-xl" />
                <MarketplaceSkeleton className="h-9 w-full rounded-xl" />
                <MarketplaceSkeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
          </section>
        </MarketplaceContainer>
      </main>
    </div>
  );
}
