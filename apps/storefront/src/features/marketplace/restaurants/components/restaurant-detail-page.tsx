import Link from 'next/link';
import { Suspense } from 'react';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceEntityNotFound } from '@/features/marketplace/shared/components/marketplace-entity-not-found';
import type { MarketplaceRestaurant } from '@/features/marketplace/restaurants/model/restaurants';
import { RestaurantMenu } from '@/features/marketplace/restaurants/components/restaurant-menu';

export function RestaurantDetailPage({
  restaurant,
}: {
  restaurant: MarketplaceRestaurant | undefined;
}) {
  if (!restaurant) {
    return (
      <MarketplaceEntityNotFound
        title="المطعم غير متاح"
        description="الرابط ده مش لمطعم موجود في البيانات المحلية الحالية."
        href="/restaurants"
        linkLabel="العودة للمطاعم"
      />
    );
  }

  return (
    <main id="marketplace-main" tabIndex={-1} className="min-h-[60vh] pb-16 pt-6">
      <MarketplaceContainer>
        <nav
          aria-label="مسار التنقل"
          className="mb-6 flex items-center gap-2.5 text-[12px] text-muted-foreground"
        >
          <Link className="text-accent no-underline" href="/">
            الرئيسية
          </Link>
          <span aria-hidden="true">/</span>
          <Link className="text-accent no-underline" href="/restaurants">
            المطاعم
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{restaurant.name}</span>
        </nav>
        <article className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-border bg-card p-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <img className="block size-14 shrink-0 rounded-2xl object-cover" src={restaurant.logo.src} alt={restaurant.logo.alt} />
            <div className="min-w-0">
              <h1 className="mb-1 mt-0 text-[20px] font-extrabold text-primary sm:text-[23px]">{restaurant.name}</h1>
              <p className="m-0 text-[11px] leading-5 text-muted-foreground">{restaurant.meta}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className="rounded-lg bg-[var(--purple-50)] px-3 py-2 text-accent">{restaurant.rating} · تقييم من النموذج</span>
            <span className="rounded-lg bg-[var(--purple-50)] px-3 py-2 text-muted-foreground">{restaurant.time} · وقت معروض</span>
          </div>
        </article>
        <section className="rounded-[24px] border border-border/70 bg-[linear-gradient(135deg,var(--purple-50),var(--card)_55%,var(--purple-50))] p-3 sm:p-5">
          <Suspense fallback={<p aria-busy="true">جارٍ تحميل الأمثلة…</p>}>
            <RestaurantMenu restaurantName={restaurant.name} />
          </Suspense>
          <Link
            className="mt-5 inline-block text-[12px] font-bold text-accent"
            href="/restaurants"
          >
            العودة للمطاعم
          </Link>
        </section>
      </MarketplaceContainer>
    </main>
  );
}
