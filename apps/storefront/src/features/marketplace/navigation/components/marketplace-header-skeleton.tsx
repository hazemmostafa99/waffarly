import { MarketplaceSkeleton } from '@/features/marketplace/shared/components/marketplace-skeleton';

export function MarketplaceHeaderSkeleton({ announce = true }: { announce?: boolean }) {
  const header = (
    <div aria-hidden={!announce}>
      <div className="grid h-7 place-items-center bg-waffarly-gold/70 px-4 sm:h-8">
        <MarketplaceSkeleton className="h-2 w-44 bg-purple-900/15 sm:w-64" />
      </div>
      <div className="bg-primary">
        <div className="marketplace-container mx-auto grid min-h-[76px] w-[min(1480px,_calc(100%_-_24px))] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:w-[min(1480px,_calc(100%_-_32px))] sm:gap-5">
          <div className="flex items-center gap-2.5">
            <MarketplaceSkeleton className="size-9 rounded-lg bg-white/15 sm:size-10" />
            <MarketplaceSkeleton className="h-9 w-28 bg-white/20 sm:w-40" />
          </div>
          <MarketplaceSkeleton className="h-10 rounded-lg bg-white/15 sm:h-12" />
          <div className="flex items-center gap-2">
            <MarketplaceSkeleton className="hidden h-9 w-16 bg-white/15 min-[1101px]:block" />
            <MarketplaceSkeleton className="size-9 rounded-full bg-white/15" />
          </div>
        </div>
      </div>
      <div className="h-10 bg-purple-800/90">
        <div className="marketplace-container mx-auto flex h-full w-[min(1480px,_calc(100%_-_24px))] items-center justify-end gap-3 overflow-hidden sm:w-[min(1480px,_calc(100%_-_32px))] sm:gap-5">
          {Array.from({ length: 7 }, (_, index) => (
            <MarketplaceSkeleton key={index} className="h-2.5 w-12 shrink-0 bg-white/20 sm:w-16" />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    announce ? (
      <div role="status" aria-live="polite" aria-busy="true" className="w-full">
        <span className="sr-only">جارٍ تحميل رأس السوق…</span>
        {header}
      </div>
    ) : header
  );
}
