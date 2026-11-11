import Link from 'next/link';
import { Suspense } from 'react';
import { Clock3, Truck, Tag } from 'lucide-react';
import { restaurantScenario } from '@/features/marketplace/data/restaurant-scenarios';
import { money } from '@/features/marketplace/shared/lib/format-money';
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

  const scenario = restaurantScenario(restaurant.name);

  return (
    <main id="marketplace-main" tabIndex={-1} className="min-h-[60vh] pb-16 pt-6">
      <MarketplaceContainer>
        <nav
          aria-label="مسار التنقل"
          className="mb-4 flex items-center gap-2.5 text-[12px] text-muted-foreground"
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
        <article className="mb-4 rounded-[20px] border border-border bg-card p-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img className="block size-12 shrink-0 rounded-xl object-cover" src={restaurant.logo.src} alt={restaurant.logo.alt} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="m-0 text-[20px] font-extrabold text-primary sm:text-[22px]">{restaurant.name}</h1>
                <span className="rounded-md bg-[var(--purple-50)] px-2 py-1 text-[9px] text-accent">تجربة محلية</span>
              </div>
              <p className="mb-0 mt-1 text-[11px] leading-5 text-muted-foreground">{restaurant.meta}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground" aria-label="معلومات المطعم التجريبية">
            <span className={`inline-flex items-center gap-1.5 font-bold ${scenario.open ? 'text-success' : 'text-destructive'}`}><span className={`size-1.5 rounded-full ${scenario.open ? 'bg-success' : 'bg-destructive'}`} aria-hidden="true" />{scenario.open ? 'مفتوح' : 'مغلق'}</span>
            <span className="inline-flex items-center gap-1.5"><Truck size={15} className="text-accent" aria-hidden="true" />التوصيل <strong className="font-bold text-primary">{money(scenario.deliveryFee)}</strong></span>
            <span className="inline-flex items-center gap-1.5"><Clock3 size={14} className="text-accent" aria-hidden="true" />{restaurant.time}</span>
            <span className="inline-flex items-center gap-1.5"><Tag size={14} className="text-accent" aria-hidden="true" />الحد الأدنى <strong className="font-bold text-primary">{money(scenario.minimumOrder)}</strong></span>
          </div>
        </article>
        <section aria-label="منيو المطعم التجريبي" className="rounded-[20px] border border-border/70 bg-card p-3 sm:p-5">
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
