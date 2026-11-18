'use client';

import Link from 'next/link';
import { CustomerOrderDetails } from './customer-orders';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { useOrdersStore } from '@/features/marketplace/orders/hooks/use-orders-store';
import {
  demoOrderTrackingSteps,
  formatDemoOrderDate,
} from '@/features/marketplace/orders/model/demo-order';
import { OrderStatusBadge } from '@/features/marketplace/orders/components/order-status-badge';

export function OrderTrackingPage({ orderId }: { orderId: string }) {
  return orderId.startsWith('demo-') ? (
    <LocalOrderTrackingPage orderId={orderId} />
  ) : (
    <CustomerOrderDetails orderId={orderId} />
  );
}
function LocalOrderTrackingPage({ orderId }: { orderId: string }) {
  const order = useOrdersStore((state) => state.orders.find((item) => item.id === orderId));
  const advanceStatus = useOrdersStore((state) => state.advanceDemoOrderStatus);
  const stopOrder = useOrdersStore((state) => state.stopDemoOrder);

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
          <section className="rounded-[18px] border border-solid border-border bg-card p-6 text-center">
            <h1 className="sr-only">التتبع غير متاح في هذه الجلسة</h1>
            <p className="mb-4 mt-0 text-sm leading-[1.8] text-muted-foreground">
              سجل الطلبات وحالات التتبع تجريبية وموجودة في ذاكرة الجلسة الحالية فقط.
            </p>
            <Link className="font-bold text-accent no-underline" href="/orders">
              العودة إلى طلباتي
            </Link>
          </section>
        </MarketplaceContainer>
      </main>
    );
  }

  const steps = demoOrderTrackingSteps(order.fulfillment);
  const stopped = order.status === 'demo-cancelled' || order.status === 'demo-rejected';
  const currentIndex = Math.max(
    steps.findIndex((step) => step.status === order.status),
    0,
  );
  const currentStep = steps[currentIndex]!;
  const isComplete = currentIndex === steps.length - 1;

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
          <Link className="text-accent no-underline" href={`/orders/${order.id}`}>
            تفاصيل الطلب
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">التتبع التجريبي</span>
        </nav>
        <h1 className="sr-only">تتبع الطلب التجريبي</h1>

        <p className="mb-4 mt-0 rounded-[10px] bg-secondary px-4 py-3 text-[12px] leading-[1.8] text-accent">
          محاكاة محلية للتصميم فقط. الحالات لا ترتبط بمتجر أو شحنة أو استلام فعلي، وتتقدم عند الضغط
          على الزر أدناه.
        </p>

        <section
          className="mx-auto max-w-[820px] rounded-[18px] border border-solid border-border bg-card p-5 shadow-[var(--shadow)] sm:p-7"
          aria-labelledby="tracking-order-id"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="mb-1 mt-0 text-xs font-bold text-muted-foreground">متابعة الطلب</p>
              <h2
                id="tracking-order-id"
                className="m-0 text-base font-extrabold text-primary"
                dir="ltr"
              >
                {order.id}
              </h2>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {order.restaurantName && <p className="font-bold text-primary">{order.restaurantName}</p>}
          {stopped ? (
            <p role="status" className="rounded-xl bg-secondary p-4 text-sm leading-6">
              {order.status === 'demo-rejected'
                ? 'المطعم رفض الطلب في المحاكاة.'
                : 'تم إلغاء الطلب في المحاكاة.'}{' '}
              مفيش طلب أو مبلغ فعلي. تقدر ترجع لتفاصيل الطلب وتعيد الأصناف للسلة.
            </p>
          ) : (
            <ol className="m-0 list-none p-0" aria-label="حالات الطلب التجريبية">
              {steps.map((step, index) => {
                const isCurrent = index === currentIndex;
                const isPast = index < currentIndex;

                return (
                  <li
                    key={step.status}
                    className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className={`relative z-10 grid size-7 place-items-center rounded-full border text-xs font-black ${
                        isCurrent || isPast
                          ? 'border-accent bg-accent text-white'
                          : 'border-border bg-white text-muted-foreground'
                      }`}
                    >
                      {isPast ? '✓' : index + 1}
                    </span>
                    {index < steps.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`absolute start-[13px] top-7 bottom-0 w-px ${isPast ? 'bg-accent' : 'bg-border'}`}
                      />
                    )}
                    <div className="pb-1">
                      <h3
                        className={`m-0 text-sm font-bold ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}
                      >
                        {step.label}
                      </h3>
                      <p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <p role="status" className="m-0 text-xs leading-5 text-muted-foreground">
              {stopped ? 'انتهت المحاكاة بالإلغاء أو الرفض' : currentStep.label}. وقت بدء العرض:{' '}
              {formatDemoOrderDate(order.createdAt)}.
            </p>
            <MarketplaceButton
              type="button"
              disabled={isComplete || stopped}
              onClick={() => advanceStatus(order.id)}
              className="min-h-10 rounded-xl bg-waffarly-gold px-4 text-sm font-black text-primary hover:bg-[#ffd353] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stopped
                ? 'انتهت المحاكاة'
                : isComplete
                  ? 'اكتمل العرض التجريبي'
                  : 'الخطوة التجريبية التالية'}
            </MarketplaceButton>
          </div>
          {order.restaurantName &&
            (order.status === 'demo-confirmed' || order.status === 'demo-preparing') && (
              <div className="mt-4 flex flex-wrap gap-3">
                <MarketplaceButton
                  onClick={() => stopOrder(order.id, 'demo-cancelled')}
                  className="min-h-10 rounded-xl border border-border px-4 text-sm text-destructive"
                >
                  محاكاة إلغاء الطلب
                </MarketplaceButton>
                <MarketplaceButton
                  onClick={() => stopOrder(order.id, 'demo-rejected')}
                  className="min-h-10 rounded-xl border border-border px-4 text-sm text-destructive"
                >
                  محاكاة رفض المطعم
                </MarketplaceButton>
              </div>
            )}
          <Link href={`/orders/${order.id}`} className="mt-5 block text-sm text-accent">
            تفاصيل الطلب وإعادة الطلب
          </Link>
        </section>
      </MarketplaceContainer>
    </main>
  );
}
