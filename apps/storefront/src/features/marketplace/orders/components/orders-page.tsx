'use client';

import Link from 'next/link';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useOrdersStore } from '@/features/marketplace/orders/hooks/use-orders-store';
import { OrdersEmptyState } from '@/features/marketplace/orders/components/orders-empty-state';
import { OrderStatusBadge } from '@/features/marketplace/orders/components/order-status-badge';
import {
  demoOrderTotal,
  formatDemoOrderDate,
} from '@/features/marketplace/orders/model/demo-order';
import { money } from '@/features/marketplace/shared/lib/format-money';

export function OrdersPage() {
  const orders = useOrdersStore((state) => state.orders);

  return (
    <main id="marketplace-main" className="min-h-[60vh] pb-16 pt-6">
      <MarketplaceContainer>
        <nav
          aria-label="مسار التنقل"
          className="mb-3 flex items-center gap-2.5 text-[12px] text-muted-foreground"
        >
          <Link className="text-accent no-underline" href="/marketplace">
            الرئيسية
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">طلباتي</span>
        </nav>
        <h1 className="sr-only">طلباتي</h1>
        <p className="mb-5 mt-0 rounded-[10px] bg-secondary px-4 py-3 text-[12px] leading-[1.8] text-accent">
          القائمة مؤقتة داخل المتصفح؛ مش متصلة بحساب أو Backend، وبتتمسح عند تحديث الصفحة.
        </p>
        {orders.length === 0 ? (
          <OrdersEmptyState />
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {orders.map((order) => (
              <li key={order.id}>
                <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-5 rounded-[18px] border border-solid border-border bg-card p-5 max-[700px]:grid-cols-1">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="m-0 text-[17px]">
                        طلب تجريبي{' '}
                        <b className="font-bold" dir="ltr">
                          {order.id}
                        </b>
                      </h2>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mb-4 mt-0 text-[12px] text-muted-foreground">
                      {formatDemoOrderDate(order.createdAt)} <span aria-hidden="true">·</span>{' '}
                      {order.fulfillment === 'delivery' ? 'توصيل تجريبي' : 'استلام تجريبي'}
                    </p>
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {order.items.slice(0, 3).map((item) => (
                        <li key={item.id} className="flex items-center gap-2.5 text-[12px]">
                          <img
                            className="size-10 rounded-lg object-cover"
                            src={item.cartImage}
                            alt=""
                          />
                          <span className="min-w-0 flex-1 truncate">{item.cartName}</span>
                          <span className="whitespace-nowrap text-muted-foreground">
                            {item.quantity} × {money(item.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {order.items.length > 3 && (
                      <p className="mb-0 mt-2 text-[11px] text-muted-foreground">
                        و{order.items.length - 3} منتجات أخرى
                      </p>
                    )}
                  </div>
                  <div className="flex min-w-36 flex-col items-end justify-between gap-4 max-[700px]:flex-row max-[700px]:items-center">
                    <div className="text-end">
                      <span className="block text-[11px] text-muted-foreground">
                        إجمالي المنتجات
                      </span>
                      <strong className="text-[18px] text-primary">
                        {money(demoOrderTotal(order))}
                      </strong>
                    </div>
                    <Link
                      className="whitespace-nowrap rounded-[10px] border border-solid border-border px-4 py-2.5 text-[12px] font-bold text-primary no-underline hover:border-accent"
                      href={`/marketplace/orders/${order.id}`}
                    >
                      تفاصيل الطلب
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </MarketplaceContainer>
    </main>
  );
}
