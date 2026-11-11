'use client';

import { useRef, useState } from 'react';
import { Search, Truck, Tag, Star, LayoutGrid, UtensilsCrossed, Sandwich, Coffee } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@waffarly/ui';
import { MarketplaceInput } from '@/components/marketplace/marketplace-form-controls';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { MarketplaceDialog } from '@/components/marketplace/marketplace-dialog';
import { productsForRestaurant } from '@/features/marketplace/restaurants/model/restaurants';
import { restaurantScenario } from '@/features/marketplace/data/restaurant-scenarios';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { MealPurchase } from './meal-purchase';
import { RestaurantMealCard } from './restaurant-meal-card';
import { money } from '@/features/marketplace/shared/lib/format-money';

function sectionIcon(section: string) {
  return section === 'all' ? LayoutGrid : section === 'أطباق جانبية' ? UtensilsCrossed : section === 'مشروبات' ? Coffee : Sandwich;
}

export function RestaurantMenu({ restaurantName }: { restaurantName: string }) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const products = productsForRestaurant({ name: restaurantName });
  const scenario = restaurantScenario(restaurantName);
  const sections = [...new Set(products.map((product) => product.menuSection ?? 'الوجبات'))];
  const filtered = products.filter((product) => (section === 'all' || product.menuSection === section) && product.name.includes(query.trim()));
  function selectMeal(product: MarketplaceProduct) {
    if (document.activeElement instanceof HTMLElement) trigger.current = document.activeElement;
    setSelected(product);
  }
  function closeMeal() {
    setSelected(null);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <div className="min-w-0">
      <div className="min-w-0">
        <header className="relative mb-5 min-h-[170px] overflow-hidden rounded-[22px] bg-[var(--purple-50)] px-5 py-6 sm:px-7">
          {products[0] && <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[48%] sm:block [mask-image:linear-gradient(to_right,black_25%,transparent_100%)]"><img {...products[0].image} className="block size-full object-cover object-center" /></div>}
          <div className="relative z-10 sm:max-w-[65%]">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 className="m-0 text-[30px] font-black leading-tight tracking-tight text-primary sm:text-[36px]">المنيو</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/85 px-2.5 py-1.5 text-[10px] font-bold text-accent"><Star size={12} className="fill-waffarly-gold text-waffarly-gold" aria-hidden="true" />تجربة محلية</span>
            </div>
            <p className="mb-4 mt-0 text-[11px] leading-5 text-muted-foreground">وجباتك المفضلة، بالحجم والإضافات اللي تحبها.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-primary">
              <span className="inline-flex items-center gap-2"><Truck size={18} className="text-accent" aria-hidden="true" />التوصيل <strong>{money(scenario.deliveryFee)}</strong></span>
              <span className="inline-flex items-center gap-2 sm:border-s sm:border-[var(--purple-100)] sm:ps-4"><Tag size={15} className="text-accent" aria-hidden="true" />الحد الأدنى <strong>{money(scenario.minimumOrder)}</strong></span>
            </div>
          </div>
        </header>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2 text-[10px] leading-5 text-muted-foreground">
          <details><summary className="w-fit cursor-pointer">الأصناف والأسعار والتوفر أمثلة محلية · تفاصيل التجربة</summary><p className="mb-0 mt-2 max-w-xl">المنيو والاختيارات ليست بيانات فعلية للمطعم. {scenario.area} · استلام أو توصيل تجريبي. عروض بيانات الواجهة لا تُطبق على الأسعار التجريبية.</p></details>
          <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-bold', scenario.open ? 'text-success' : 'text-destructive')}><span className={cn('size-1.5 rounded-full', scenario.open ? 'bg-success' : 'bg-destructive')} aria-hidden="true" />{scenario.open ? 'مفتوح — تجربة' : 'مغلق — تجربة'}</span>
        </div>
        {!scenario.open && <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">المطعم مغلق في السيناريو ده. تقدر تتصفح المنيو أو <Link href="/restaurants" className="text-accent">تختار مطعم تاني</Link>.</p>}
        <label className="mb-4 flex items-center gap-2.5 rounded-[15px] border border-[var(--purple-100)] bg-white/70 px-4 py-3.5 transition-colors focus-within:border-accent focus-within:bg-white">
          <Search size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="sr-only">ابحث في المنيو</span>
          <MarketplaceInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بتدور على إيه في المنيو؟" className="min-w-0 flex-1 text-[12px] outline-none focus-visible:outline-none focus-visible:ring-0" />
        </label>
        <div className="mb-7 flex flex-wrap gap-2" aria-label="أقسام المنيو">
          {['all', ...sections].map((value) => {
            const Icon = sectionIcon(value);
            return <MarketplaceButton key={value} type="button" tone={section === value ? 'primary' : 'neutral'} onClick={() => setSection(value)} aria-pressed={section === value} className={cn('inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-[11px] font-bold transition-colors', section === value ? 'border-primary' : 'border-[var(--purple-100)] bg-white/70')}><Icon size={16} strokeWidth={1.6} aria-hidden="true" />{value === 'all' ? 'الكل' : value}</MarketplaceButton>;
          })}
        </div>
        {filtered.length ? sections.filter((value) => filtered.some((product) => product.menuSection === value)).map((value) => {
          const Icon = sectionIcon(value);
          const items = filtered.filter((product) => product.menuSection === value);
          return <section key={value} className="mb-7 last:mb-0">
            <div className="mb-3 flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-xl bg-waffarly-gold/10 text-accent"><Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span><h3 className="m-0 text-[19px] font-extrabold text-primary">{value}</h3><span className="rounded-full bg-secondary/60 px-2.5 py-1 text-[9px] text-accent">{items.length} أصناف</span></div>
            <div className="flex flex-wrap items-stretch gap-3">
              {items.map((product) => <RestaurantMealCard key={product.id} product={product} restaurantOpen={scenario.open} selected={selected?.id === product.id} onSelect={() => selectMeal(product)} />)}
            </div>
          </section>;
        }) : <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center"><p className="text-sm">مفيش وجبات مطابقة لبحثك.</p><MarketplaceButton type="button" tone="neutral" onClick={() => { setQuery(''); setSection('all'); }} className="min-h-10 rounded-xl px-4 text-sm">عرض كل المنيو</MarketplaceButton></div>}
      </div>
      <MarketplaceDialog open={selected !== null} onClose={closeMeal} title="تخصيص المنتج"
        className="w-[calc(100vw-24px)] max-w-[360px] max-h-[calc(100dvh-20px)] overflow-hidden rounded-[24px] open:flex open:flex-col [&_[data-slot=dialog-header]]:shrink-0 [&_[data-slot=dialog-header]]:border-0 [&_[data-slot=dialog-header]]:px-5 [&_[data-slot=dialog-header]]:pb-2 [&_[data-slot=dialog-header]]:pt-5 [&_[data-slot=dialog-header]_h2]:text-[18px] [&_[data-slot=dialog-header]_button]:size-8 [&_[data-slot=dialog-header]_button]:rounded-full [&_[data-slot=dialog-header]_button]:bg-[var(--purple-50)] [&_[data-slot=dialog-header]_button:hover]:bg-secondary"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {selected && <MealPurchase key={selected.id} product={selected} presentation="dialog" onAdded={() => setSelected(null)} />}
      </MarketplaceDialog>
    </div>
  );
}
