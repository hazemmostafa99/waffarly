'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceInput } from '@/components/marketplace/marketplace-form-controls';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { useRestaurants } from '../hooks/use-restaurants';
import { restaurantHref } from '@/features/marketplace/restaurants/model/restaurants';

export function RestaurantsIndexPage() {
  const remote = useRestaurants();
  const data = { restaurants: remote.data ?? [] };
  const reference = data;
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get('q') ?? '';
  const cuisine = params.get('cuisine') ?? 'all';
  const openOnly = params.get('open') === '1';
  const sort = params.get('sort') ?? 'recommended';
  const cuisines = [...new Set(reference.restaurants.map((restaurant) => restaurant.meta.split('•')[0]!.trim()))];
  function navigate(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([key, value]) => {
      if (!value || value === 'all' || value === 'recommended') next.delete(key); else next.set(key, value);
    });
    router.push(`/restaurants${next.size ? `?${next}` : ''}`, { scroll: false });
  }
  const restaurants = reference.restaurants.filter((restaurant) =>
    `${restaurant.name} ${restaurant.meta}`.includes(query.trim()) &&
    (cuisine === 'all' || restaurant.meta.split('•')[0]!.trim() === cuisine) &&
    (!openOnly || restaurant.settings?.acceptingOrders === true),
  ).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ar') : 0);

  if (remote.isPending) return <p role="status" className="p-5 text-sm">جارٍ تحميل المطاعم…</p>;
  if (remote.isError) return <div role="alert" className="p-5 text-sm"><p>تعذر تحميل المطاعم من الخادم.</p><button type="button" onClick={() => remote.refetch()}>إعادة المحاولة</button></div>;
  return <main id="marketplace-main" tabIndex={-1} className="min-h-[60vh] py-7">
    <MarketplaceContainer>
      <Link href="/" className="text-sm text-accent">الرئيسية</Link>
      <h1 className="mb-2 text-2xl font-black">اختار مطعمك</h1>
      <p className="mb-5 text-sm leading-6 text-muted-foreground">تصفح منيو المطاعم واختار وجبتك. السعر النهائي ورسوم التوصيل بيتراجعوا قبل إرسال الطلب.</p>
      <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); navigate({ q: String(data.get('q') ?? '') }); }} className="mb-5 flex gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">ابحث باسم المطعم أو نوع الأكل</span><MarketplaceInput key={query} name="q" defaultValue={query} placeholder="اسم المطعم أو نوع الأكل" className="w-full rounded-xl border border-border bg-card p-3" /></label>
        <MarketplaceButton type="submit" className="rounded-xl bg-waffarly-gold px-5 font-bold">بحث</MarketplaceButton>
      </form>
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4 text-sm">
        <label className="grid gap-2">نوع الأكل<select value={cuisine} onChange={(event) => navigate({ cuisine: event.target.value })} className="min-h-10 rounded-lg border border-border bg-card px-3"><option value="all">كل الأنواع</option>{cuisines.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="grid gap-2">الترتيب<select value={sort} onChange={(event) => navigate({ sort: event.target.value })} className="min-h-10 rounded-lg border border-border bg-card px-3"><option value="recommended">الترتيب الافتراضي</option><option value="name">الاسم</option></select></label>
        <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={openOnly} onChange={(event) => navigate({ open: event.target.checked ? '1' : '' })} />يستقبل طلبات الآن</label>
        <Link href="/restaurants" className="py-3 text-accent">مسح الفلاتر</Link>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{restaurants.length} مطعم مطابق</p>
      {restaurants.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {restaurants.map((restaurant) => <Link key={restaurant.name} href={restaurantHref(restaurant)} className="overflow-hidden rounded-2xl border border-border bg-card text-inherit no-underline hover:shadow-lg">
          <img {...restaurant.cover} loading="lazy" className="h-40 w-full object-cover" />
          <div className="space-y-2 p-4"><h2 className="m-0 text-lg font-bold">{restaurant.name}</h2><p className="m-0 text-sm text-muted-foreground">{restaurant.meta}</p><span className="block text-xs text-accent">{restaurant.settings?.acceptingOrders ? 'يستقبل طلبات الآن' : 'لا يستقبل طلبات حاليًا'}</span><span className="block text-sm font-bold text-primary">تصفح المنيو ←</span></div>
        </Link>)}
      </div> : <div className="rounded-2xl bg-secondary p-8 text-center"><p>مفيش مطاعم مطابقة. جرّب اسم تاني أو امسح الفلاتر.</p><Link href="/restaurants" className="font-bold text-accent">عرض كل المطاعم</Link></div>}
    </MarketplaceContainer>
  </main>;
}
