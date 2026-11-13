'use client';

import type { PublicRestaurantProfile } from '@waffarly/contracts';
import { useRef, useState } from 'react';
import { Search, LayoutGrid, UtensilsCrossed, Sandwich, Coffee } from 'lucide-react';
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

function sectionIcon(section: string) {
  return section === 'all' ? LayoutGrid : section === 'أطباق جانبية' ? UtensilsCrossed : section === 'مشروبات' ? Coffee : Sandwich;
}

export function RestaurantMenu({ restaurantName, products: suppliedProducts, settings }: { restaurantName: string; products?: MarketplaceProduct[]; settings?: PublicRestaurantProfile }) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const products = suppliedProducts ?? productsForRestaurant({ name: restaurantName });
  const scenario = settings ? { open: settings.acceptingOrders } : restaurantScenario(restaurantName);
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
        {!scenario.open && <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm">{settings ? 'المطعم لا يستقبل طلبات حاليًا.' : 'المطعم مغلق في السيناريو ده.'} تقدر تتصفح المنيو أو <Link href="/restaurants" className="text-accent">تختار مطعم تاني</Link>.</p>}
        <label className="mb-4 flex items-center gap-2.5 rounded-[15px] border border-[var(--purple-100)] bg-white/70 px-4 py-3.5 transition-colors focus-within:border-accent focus-within:bg-white">
          <Search size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="sr-only">ابحث في المنيو</span>
          <MarketplaceInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بتدور على إيه في المنيو؟" className="min-w-0 flex-1 text-[12px] outline-none focus-visible:outline-none focus-visible:ring-0" />
        </label>
        <div className="mb-5 flex flex-wrap gap-2" aria-label="أقسام المنيو">
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
