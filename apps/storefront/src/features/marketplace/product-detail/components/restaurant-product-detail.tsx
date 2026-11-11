import Link from 'next/link';
import { ArrowLeft, Store, Truck, UtensilsCrossed } from 'lucide-react';
import type { MarketplaceProduct } from '@/features/marketplace/catalog/model/catalog';
import { FavoriteButton } from '@/features/marketplace/favorites/components/favorite-button';
import { MealPurchase } from '@/features/marketplace/restaurants/components/meal-purchase';
import { productsForRestaurant } from '@/features/marketplace/restaurants/model/restaurants';
import { restaurantScenario } from '@/features/marketplace/data/restaurant-scenarios';
import { mealAvailable } from '@/features/marketplace/restaurants/model/meal-options';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function RestaurantProductDetail({ product, relatedProducts }: { product: MarketplaceProduct; relatedProducts?: MarketplaceProduct[] }) {
  const name = product.merchantName ?? product.seller;
  const restaurantUrl = `/restaurants/${encodeURIComponent(product.restaurantSlug ?? name)}`;
  const scenario = product.restaurantSettings ? { open: product.restaurantSettings.isOpen, deliveryFee: Number(product.restaurantSettings.deliveryFee) } : restaurantScenario(name);
  const available = mealAvailable(product);
  const related = (relatedProducts ?? productsForRestaurant({ name })).filter((item) => item.id !== product.id).slice(0, 3);

  return <>
    <article className="mx-auto grid w-full max-w-[1480px] items-start gap-5 rounded-[24px] border border-border/70 bg-card p-4 shadow-[var(--shadow)] md:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
      <div className="min-w-0 rounded-[18px] bg-[var(--purple-50)] p-2 lg:sticky lg:top-5">
        <div className="relative overflow-hidden rounded-[14px]">
          <img {...product.image} className="block aspect-[4/3] max-h-[360px] w-full object-cover lg:aspect-square lg:max-h-[520px]" />
          <span className="absolute start-3 top-3 rounded-full bg-waffarly-gold px-3 py-1.5 text-[10px] font-bold text-primary">صورة توضيحية</span>
          <FavoriteButton productId={product.id} name={product.cartName} />
        </div>
        <Link href={restaurantUrl} className="flex items-center justify-between gap-2 px-2 pb-1 pt-3 text-[11px] font-bold text-accent no-underline hover:text-primary"><span>العودة إلى قائمة المطعم</span><ArrowLeft size={14} aria-hidden="true" /></Link>
      </div>
      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--purple-50)] px-2.5 py-1 text-[10px] text-accent"><UtensilsCrossed size={12} aria-hidden="true" />منيو تجريبي محلي</span>
          <span className="rounded-full bg-[var(--purple-50)] px-2.5 py-1 text-[10px] text-accent">{product.menuSection ?? 'الوجبات'}</span>
        </div>
        <h1 className="mb-2 mt-0 text-[23px] font-extrabold leading-[1.5] text-primary sm:text-[26px]">{product.name}</h1>
        <p className="mb-3 mt-0 text-[12px] leading-6 text-muted-foreground">{product.description ?? 'اختار الحجم والإضافات اللي تناسبك.'}</p>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
          <span className={`inline-flex items-center gap-1.5 font-bold ${available ? 'text-success' : 'text-destructive'}`}><span className={`size-1.5 rounded-full ${available ? 'bg-success' : 'bg-destructive'}`} aria-hidden="true" />{!scenario.open ? 'المطعم مغلق — تجربة' : available ? 'متاح في التجربة' : 'الصنف غير متاح — تجربة'}</span>
          <span className="inline-flex items-center gap-1.5"><Truck size={13} aria-hidden="true" />التوصيل التجريبي {money(scenario.deliveryFee)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[15px] border border-[var(--purple-100)] bg-[var(--purple-50)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-accent"><Store size={18} aria-hidden="true" /></span>
            <div className="min-w-0"><span className="mb-1 block text-[9px] text-muted-foreground">من منيو المطعم</span><Link href={restaurantUrl} className="text-[12px] font-bold text-accent no-underline hover:underline">{name}</Link></div>
          </div>
          <div className="shrink-0 sm:border-s sm:border-[var(--purple-100)] sm:ps-4"><span className="mb-0.5 block text-[9px] text-muted-foreground">السعر الأساسي</span><strong className="text-[22px] font-extrabold leading-7 text-accent">{money(product.price)}</strong></div>
        </div>
        <MealPurchase key={product.id} product={product} presentation="page" />
        <p className="mb-0 mt-2 text-[9px] leading-4 text-muted-foreground">الأصناف والاختيارات والأسعار للتجربة المحلية فقط. التوصيل يُحسب في إتمام الطلب.</p>
      </div>
    </article>
    {related.length > 0 && <section aria-label="أصناف أخرى من المطعم" className="mx-auto mt-5 w-full max-w-[1480px]">
      <h2 className="mb-3 mt-0 text-[16px] font-bold text-primary">كمان من نفس المطعم</h2>
      <div className="flex flex-wrap gap-3">{related.map((item) => <Link key={item.id} href={`/products/${encodeURIComponent(item.id)}${product.restaurantSlug ? `?restaurant=${encodeURIComponent(product.restaurantSlug)}` : ''}`} className="flex w-[260px] max-w-full items-center gap-3 rounded-2xl border border-border bg-card p-2 text-inherit no-underline transition-colors hover:border-accent">
        <img {...item.image} className="block size-14 shrink-0 rounded-xl object-cover" /><div className="min-w-0"><h3 className="mb-1 mt-0 text-[12px] font-bold leading-5">{item.name}</h3><span className="text-[11px] font-bold text-accent">من {money(item.price)}</span></div>
      </Link>)}</div>
    </section>}
  </>;
}
