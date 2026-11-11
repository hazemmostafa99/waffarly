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
        <article className="overflow-hidden rounded-[20px] border border-solid border-border bg-card shadow-[var(--shadow)]">
          <div className="relative h-[260px] bg-secondary max-[700px]:h-[190px]">
            <img
              className="size-full object-cover"
              src={restaurant.cover.src}
              alt={restaurant.cover.alt}
            />
            <span className="absolute right-4 top-4 rounded-lg bg-destructive px-3 py-2 text-[12px] font-black text-white">
              {restaurant.offer}
            </span>
          </div>
          <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-5 p-6 max-[700px]:grid-cols-[72px_minmax(0,1fr)] max-[700px]:gap-3.5 max-[700px]:p-4">
            <img
              className="size-24 rounded-full border-4 border-solid border-white object-cover shadow-[0_4px_13px_rgba(31,10,41,0.2)] max-[700px]:size-[72px]"
              src={restaurant.logo.src}
              alt={restaurant.logo.alt}
            />
            <div className="min-w-0">
              <span className="mb-2 inline-block rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold text-accent">
                مطعم من بيانات العرض المحلية
              </span>
              <h1 className="mb-2 mt-0 text-[26px] leading-[1.4] max-[700px]:text-[21px]">
                {restaurant.name}
              </h1>
              <p className="m-0 text-[12px] leading-[1.8] text-muted-foreground">
                {restaurant.meta}
              </p>
            </div>
          </div>
          <dl className="mx-6 mb-6 mt-0 grid grid-cols-2 gap-3 max-[700px]:mx-4 max-[700px]:mb-4">
            <div className="rounded-xl bg-secondary p-4">
              <dt className="mb-1 text-[11px] text-muted-foreground">التقييم المعروض</dt>
              <dd className="m-0 font-extrabold text-primary">{restaurant.rating}</dd>
            </div>
            <div className="rounded-xl bg-secondary p-4">
              <dt className="mb-1 text-[11px] text-muted-foreground">وقت التوصيل المعروض</dt>
              <dd className="m-0 font-extrabold text-success">{restaurant.time}</dd>
            </div>
          </dl>
        </article>
        <section className="mt-6 rounded-[18px] border border-solid border-border bg-card p-6 max-[700px]:p-4">
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
