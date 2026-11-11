'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { useCartStore } from '@/features/marketplace/cart/hooks/use-cart-store';
import { useOrdersStore } from '@/features/marketplace/orders/hooks/use-orders-store';
import { OrderStatusBadge } from '@/features/marketplace/orders/components/order-status-badge';
import {
  demoOrderTotal,
  formatDemoOrderDate,
} from '@/features/marketplace/orders/model/demo-order';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const order = useOrdersStore((state) => state.orders.find((item) => item.id === orderId));
  const addToCart = useCartStore((state) => state.addToCart);
  const [reorderResult, setReorderResult] = useState<{ added: number; skipped: number } | null>(
    null,
  );

  function handleReorder() {
    if (!order) return;

    let added = 0;
    for (const item of order.items) {
      if (addToCart(item.id, item.quantity)) added += 1;
    }
    setReorderResult({ added, skipped: order.items.length - added });
  }

  if (!order) {
    return (
      <main id="marketplace-main" className="min-h-[60vh] pb-16 pt-6">
        <MarketplaceContainer>
          <nav
            aria-label="مسار التنقل"
            className="mb-3 flex items-center gap-2.5 text-[12px] text-muted-foreground"
          >
            <Link className="text-accent no-underline" href="/">
              الرئيسية
            </Link>
            <span aria-hidden="true">/</span>
            <Link className="text-accent no-underline" href="/orders">
              طلباتي
            </Link>
          </nav>
          <section
            className="rounded-[18px] border border-solid border-border bg-card p-8 text-center"
            aria-labelledby="order-unavailable-title"
          >
            <h1 id="order-unavailable-title" className="sr-only">
              تفاصيل الطلب مش متاحة في الجلسة دي
            </h1>
            <p className="leading-[1.8] text-muted-foreground">
              سجل الطلبات تجريبي وموجود في ذاكرة الصفحة فقط. افتح تفاصيله من «طلباتي» قبل تحديث
              الصفحة.
            </p>
            <Link className="text-accent" href="/orders">
              العودة إلى طلباتي
            </Link>
          </section>
        </MarketplaceContainer>
      </main>
    );
  }

  return (
    <main id="marketplace-main" className="min-h-[60vh] pb-16 pt-6">
      <MarketplaceContainer>
        <nav
          aria-label="مسار التنقل"
          className="mb-3 flex items-center gap-2.5 text-[12px] text-muted-foreground"
        >
          <Link className="text-accent no-underline" href="/">
            الرئيسية
          </Link>
          <span aria-hidden="true">/</span>
          <Link className="text-accent no-underline" href="/orders">
            طلباتي
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">تفاصيل الطلب</span>
        </nav>
        <header className="mb-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="sr-only">
              تفاصيل الطلب
            </h1>
            <p className="m-0 text-[13px] text-muted-foreground" dir="ltr">
              {order.id}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </header>
        <p className="mb-5 mt-0 rounded-[10px] bg-secondary px-4 py-3 text-[12px] leading-[1.8] text-accent">
          دي حالة تجريبية محلية للتصميم فقط؛ مش تأكيد شراء أو شحن فعلي.
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_330px] items-start gap-6 max-[1000px]:grid-cols-[minmax(0,1fr)_290px] max-[768px]:grid-cols-1">
          <section
            className="min-w-0 rounded-[18px] border border-solid border-border bg-card p-5"
            aria-labelledby="order-products-title"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id="order-products-title" className="m-0 text-[19px]">
                المنتجات
              </h2>
              <span className="text-[12px] text-muted-foreground">
                {order.items.reduce((count, item) => count + item.quantity, 0)} قطعة
              </span>
            </div>
            <ul className="m-0 list-none divide-y divide-border p-0">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <img
                    className="size-16 rounded-[10px] object-cover"
                    src={item.cartImage}
                    alt=""
                  />
                  <div className="min-w-0">
                    <h3 className="m-0 text-[14px] leading-[1.7]">{item.cartName}</h3>
                    <p className="mb-0 mt-1 text-[12px] text-muted-foreground">
                      الكمية: {item.quantity}
                    </p>
                  </div>
                  <strong className="whitespace-nowrap text-[13px] text-primary">
                    {money(item.price * item.quantity)}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
          <aside
            className="rounded-[18px] border border-solid border-border bg-card p-5"
            aria-labelledby="order-summary-title"
          >
            <h2 id="order-summary-title" className="mb-5 mt-0 text-[18px]">
              ملخص الطلب
            </h2>
            <dl className="m-0 grid gap-4 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">وقت التأكيد التجريبي</dt>
                <dd className="m-0 text-end">{formatDemoOrderDate(order.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">طريقة الاستلام</dt>
                <dd className="m-0">
                  {order.fulfillment === 'delivery' ? 'توصيل تجريبي' : 'استلام تجريبي'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-solid border-border pt-4">
                <dt>إجمالي المنتجات</dt>
                <dd className="m-0 text-[19px] font-extrabold text-primary">
                  {money(demoOrderTotal(order))}
                </dd>
              </div>
            </dl>
            <p className="mb-0 mt-5 text-[11px] leading-[1.8] text-muted-foreground">
              الإجمالي لا يشمل رسومًا إضافية، ولا يوجد دفع فعلي.
            </p>
            <div className="mt-5 grid gap-2">
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-bold text-primary no-underline hover:border-accent"
                href={`/orders/${order.id}/tracking`}
              >
                متابعة حالة الطلب التجريبية
              </Link>
              <MarketplaceButton
                type="button"
                onClick={handleReorder}
                className="min-h-11 w-full rounded-xl bg-waffarly-gold px-4 text-sm font-black text-primary hover:bg-[#ffd353]"
              >
                إعادة المنتجات إلى السلة
              </MarketplaceButton>
              <Link
                className="text-center text-[13px] text-accent no-underline"
                href="/orders"
              >
                كل طلباتي
              </Link>
            </div>
            {reorderResult && (
              <p
                role="status"
                className="mb-0 mt-3 rounded-xl bg-secondary px-3 py-2.5 text-xs leading-5 text-accent"
              >
                {reorderResult.added > 0
                  ? `تمت إضافة ${reorderResult.added} ${reorderResult.added === 1 ? 'منتج' : 'منتجات'} إلى السلة التجريبية.`
                  : 'لم نتمكن من إضافة منتجات هذا الطلب إلى السلة.'}
                {reorderResult.skipped > 0 &&
                  ` تعذرت إضافة ${reorderResult.skipped} ${reorderResult.skipped === 1 ? 'منتج' : 'منتجات'} بسبب حدود الكمية أو عدم توفرها.`}
                {reorderResult.added > 0 && (
                  <>
                    {' '}
                    <Link className="font-bold text-primary" href="/cart">
                      عرض السلة
                    </Link>
                  </>
                )}
              </p>
            )}
          </aside>
        </div>
      </MarketplaceContainer>
    </main>
  );
}
