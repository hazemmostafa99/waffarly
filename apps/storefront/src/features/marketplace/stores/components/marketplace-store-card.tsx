import Link from 'next/link';
import type { MarketplaceStore } from '@/features/marketplace/stores/model/stores';
import { storeHref } from '@/features/marketplace/stores/model/stores';

export function MarketplaceStoreCard({ store }: { store: MarketplaceStore }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white shadow-[var(--shadow)] transition-transform hover:-translate-y-1">
      <Link href={storeHref(store)} className="block text-inherit no-underline">
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <div className="size-[76px] shrink-0 overflow-hidden rounded-2xl bg-secondary">
            <img src={store.image.src} alt={store.image.alt} className="size-full object-cover" loading="lazy" />
          </div>
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-extrabold text-primary">{store.name}</h2>
            <p className="mb-2 mt-1 text-sm leading-6 text-muted-foreground">{store.description}</p>
            <span className="text-sm font-bold text-accent">تصفّح منتجات المتجر ←</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
