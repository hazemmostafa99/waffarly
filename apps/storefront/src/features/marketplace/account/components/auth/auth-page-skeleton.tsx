import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceHeaderSkeleton } from '@/features/marketplace/navigation/components/marketplace-header-skeleton';
import { MarketplaceSkeleton } from '@/features/marketplace/shared/components/marketplace-skeleton';

export function AuthPageSkeleton() {
  return (
    <div
      className="marketplace-theme min-h-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">جارٍ تجهيز صفحة الحساب…</span>
      <MarketplaceHeaderSkeleton announce={false} />
      <main className="pb-14 pt-6">
        <MarketplaceContainer>
          <MarketplaceSkeleton className="mb-3 h-3.5 w-36" />
          <section className="grid overflow-hidden rounded-3xl border border-border bg-white shadow-[var(--shadow)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
            <div className="order-2 bg-primary p-5 sm:p-7 lg:order-2 lg:p-8">
              <MarketplaceSkeleton className="h-5 w-24 bg-white/20" />
              <MarketplaceSkeleton className="mt-5 h-6 w-64 max-w-full bg-white/20" />
              <MarketplaceSkeleton className="mt-2 h-3 w-full bg-white/15" />
              <MarketplaceSkeleton className="mt-2 h-3 w-4/5 bg-white/15" />
            </div>
            <div className="order-1 grid content-start gap-4 p-5 sm:p-7 lg:order-1 lg:p-9">
              <MarketplaceSkeleton className="h-3 w-24" />
              <MarketplaceSkeleton className="h-8 w-56 max-w-full" />
              <MarketplaceSkeleton className="h-3 w-72 max-w-full" />
              <MarketplaceSkeleton className="mt-2 h-11 w-full rounded-xl" />
              <MarketplaceSkeleton className="h-11 w-full rounded-xl" />
              <MarketplaceSkeleton className="h-11 w-full rounded-xl" />
              <MarketplaceSkeleton className="mt-2 h-4 w-48 max-w-full justify-self-center" />
            </div>
          </section>
        </MarketplaceContainer>
      </main>
    </div>
  );
}
