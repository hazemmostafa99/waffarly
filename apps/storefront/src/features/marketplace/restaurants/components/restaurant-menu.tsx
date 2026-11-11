'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MarketplaceInput } from '@/components/marketplace/marketplace-form-controls';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';
import { productsForRestaurant } from '@/features/marketplace/restaurants/model/restaurants';
import { restaurantScenario } from '@/features/marketplace/data/restaurant-scenarios';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { MealPurchase } from './meal-purchase';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function RestaurantMenu({ restaurantName }: { restaurantName: string }) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const products = productsForRestaurant({ name: restaurantName });
  const scenario = restaurantScenario(restaurantName);
  const sections = [...new Set(products.map((product) => product.menuSection ?? 'الوجبات'))];
  const filtered = products.filter((product) => (section === 'all' || product.menuSection === section) && product.name.includes(query.trim()));

  return (
    <>
      <h2 className="mb-2 mt-0 text-xl font-bold">المنيو التجريبي</h2>
      <p className="rounded-xl bg-secondary p-3 text-xs leading-6 text-accent">كل الأصناف والأحجام والأسعار وحالات التوفر هنا أمثلة محلية للتصميم، وليست بيانات فعلية للمطعم.</p>
      <p className="text-xs leading-5 text-muted-foreground">عروض كارت المطعم من بيانات الواجهة المرجعية؛ لا تُطبق على أسعار المنيو أو رسوم التوصيل التجريبية.</p>
      <div className="mb-5 flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg bg-secondary px-3 py-2">{scenario.open ? 'مفتوح — تجربة' : 'مغلق — تجربة'}</span>
        <span className="rounded-lg bg-secondary px-3 py-2">التوصيل {money(scenario.deliveryFee)} · حد أدنى {money(scenario.minimumOrder)}</span>
        <span className="rounded-lg bg-secondary px-3 py-2">{scenario.area} · استلام أو توصيل تجريبي</span>
      </div>
      {!scenario.open && <p role="status" className="rounded-xl border border-border p-4 text-sm">المطعم مغلق في السيناريو ده. تقدر تتصفح المنيو أو <Link href="/restaurants" className="text-accent">تختار مطعم تاني</Link>.</p>}
      <label className="mb-4 grid gap-2 text-sm font-bold">ابحث في المنيو
        <MarketplaceInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اسم الوجبة" className="rounded-xl border border-border bg-card p-3" />
      </label>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="أقسام المنيو">
        {['all', ...sections].map((value) => <MarketplaceButton key={value} onClick={() => setSection(value)} aria-pressed={section === value} className={`min-h-10 rounded-full border border-border px-4 text-sm ${section === value ? 'bg-primary text-white' : 'bg-card text-primary'}`}>{value === 'all' ? 'كل المنيو' : value}</MarketplaceButton>)}
      </div>
      {filtered.length ? sections.filter((value) => filtered.some((product) => product.menuSection === value)).map((value) => (
        <section key={value} className="mb-7">
          <h3 className="mb-3 text-lg font-bold">{value}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.filter((product) => product.menuSection === value).map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <img {...product.image} loading="lazy" className="h-40 w-full object-cover" />
                <div className="space-y-3 p-4">
                  <h4 className="m-0 text-base font-bold"><Link href={`/products/${product.id}`} className="text-inherit no-underline">{product.name}</Link></h4>
                  <p className="m-0 text-xs text-muted-foreground">صنف توضيحي محلي · الحجم والإضافات في الخطوة التالية</p>
                  <strong className="block text-primary">من {money(product.price)}</strong>
                  <MarketplaceButton disabled={!scenario.open || product.available === false} onClick={() => setSelected(product)} className="min-h-11 w-full rounded-xl bg-waffarly-gold px-4 text-sm font-bold text-primary disabled:opacity-50">{!scenario.open ? 'المطعم مغلق — تجربة' : product.available === false ? 'غير متاح — تجربة' : 'اختار الحجم والإضافات'}</MarketplaceButton>
                </div>
              </article>
            ))}
          </div>
        </section>
      )) : <div className="rounded-xl bg-secondary p-6 text-center"><p>مفيش وجبات مطابقة لبحثك.</p><MarketplaceButton onClick={() => { setQuery(''); setSection('all'); }} className="min-h-10 rounded-xl border border-border px-4">عرض كل المنيو</MarketplaceButton></div>}
      <MarketplaceDialog open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? 'اختار وجبتك'}>
        {selected && <MealPurchase key={selected.id} product={selected} onAdded={() => setSelected(null)} />}
      </MarketplaceDialog>
    </>
  );
}
