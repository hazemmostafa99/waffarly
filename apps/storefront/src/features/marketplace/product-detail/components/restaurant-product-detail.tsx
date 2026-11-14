import Link from 'next/link';
import { Store, Truck } from 'lucide-react';
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
  const scenario = product.restaurantSettings ? { open: product.restaurantSettings.acceptingOrders, deliveryFee: Number(product.restaurantSettings.deliveryFee) } : restaurantScenario(name);
  const available = mealAvailable(product);
  const related = (relatedProducts ?? productsForRestaurant({ name })).filter((item) => item.id !== product.id).slice(0, 3);

  return <>
    <article className="mx-auto grid w-full max-w-[1240px] items-start gap-5 rounded-[20px] border border-border/70 bg-card p-4 shadow-[var(--shadow)] md:p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="min-w-0 md:sticky md:top-5">
        <div className="relative overflow-hidden rounded-[14px]">
          <img {...product.image} className="block h-[220px] w-full object-cover object-center sm:h-[300px] md:h-[380px]" />
          <span className="absolute start-3 top-3 rounded-full bg-waffarly-gold px-3 py-1.5 text-[10px] font-bold text-primary">صورة توضيحية</span>
          <FavoriteButton productId={product.id} name={product.cartName} product={product} />
        </div>

      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="m-0 min-w-0 text-[24px] font-bold leading-9 text-primary">{product.name}</h1>
          <div className="inline-flex shrink-0 items-baseline gap-1.5"><span className="text-[11px] text-muted-foreground">يبدأ من</span><strong className="text-[21px] font-bold text-accent">{money(product.price)}</strong></div>
        </div>
        {product.description && <p className="mb-2 mt-2 text-[13px] leading-6 text-muted-foreground">{product.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground">
          <Link href={restaurantUrl} className="inline-flex items-center gap-1.5 text-accent no-underline hover:underline"><Store size={14} aria-hidden="true" />{name}</Link>
          <span className={`inline-flex items-center gap-1.5 ${available ? 'text-success' : 'text-destructive'}`}><span className={`size-1.5 rounded-full ${available ? 'bg-success' : 'bg-destructive'}`} aria-hidden="true" />{!scenario.open ? 'المطعم مغلق' : available ? 'متاح للطلب' : 'الصنف غير متاح'}{!product.restaurantSlug && ' — تجربة'}</span>
          <span className="inline-flex items-center gap-1.5"><Truck size={13} aria-hidden="true" />التوصيل من {money(Number(product.restaurantSettings?.deliveryFeeFrom ?? scenario.deliveryFee))}</span>
        </div>
        <MealPurchase key={product.id} product={product} presentation="page" />
        <p className="mb-0 mt-2 text-[11px] leading-5 text-muted-foreground">{product.restaurantSlug ? 'السعر النهائي والتوصيل يُراجعان مع المطعم قبل تأكيد الطلب.' : 'الأصناف والاختيارات والأسعار للتجربة المحلية فقط. التوصيل يُحسب في إتمام الطلب.'}</p>
      </div>
    </article>
    {related.length > 0 && <section aria-label="أصناف أخرى من المطعم" className="mx-auto mt-5 w-full max-w-[1240px]">
      <h2 className="mb-3 mt-0 text-[16px] font-bold text-primary">كمان من نفس المطعم</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{related.map((item) => <Link key={item.id} href={`/products/${encodeURIComponent(item.id)}${product.restaurantSlug ? `?restaurant=${encodeURIComponent(product.restaurantSlug)}` : ''}`} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-3 text-inherit no-underline transition-colors hover:border-accent">
        <img {...item.image} className="block size-16 shrink-0 rounded-xl object-cover" /><div className="min-w-0"><h3 className="mb-1 mt-0 text-[14px] font-medium leading-6">{item.name}</h3><span className="text-[13px] font-bold text-accent">من {money(item.price)}</span></div>
      </Link>)}</div>
    </section>}
  </>;
}
