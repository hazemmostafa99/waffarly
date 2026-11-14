'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock3, Store, Truck, ShoppingBag, RefreshCw } from 'lucide-react';
import type { CustomerOrderView } from '@waffarly/contracts';
import { MarketplaceContainer } from '@/components/marketplace/marketplace-container';
import { MarketplaceCard } from '@/components/marketplace/marketplace-card';
import { MarketplaceButton } from '@/components/marketplace/marketplace-button';
import { money } from '@/features/marketplace/shared/lib/format-money';
import { useCustomerOrders } from '../hooks/use-customer-orders';
import { fulfillmentLabel, isFinishedOrder, orderDate, shortOrderId } from '../model/customer-order-presentation';
import { CustomerOrderStatus, CustomerOrderError, CustomerOrdersEmpty, CustomerOrdersSkeleton, GuestOrderNotice } from './customer-order-shared';

type OrderFilter = 'all' | 'active' | 'past';
const filters = [
  { id: 'all', label: 'كل الطلبات' },
  { id: 'active', label: 'طلبات جارية' },
  { id: 'past', label: 'طلبات سابقة' },
] as const;

export function OrderPreview({ order }: { order: CustomerOrderView }) {
  const date = orderDate(order.createdAt);
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const DeliveryIcon = order.fulfillmentType === 'pickup' ? ShoppingBag : Truck;

  return (
    <MarketplaceCard className="overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-none transition-colors hover:border-accent/30">
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_190px]">
        <div className="min-w-0 p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-[var(--purple-50)] text-accent">
              <Store size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 className="m-0 text-base font-bold leading-6 text-primary">{order.restaurantName}</h2>
                <CustomerOrderStatus status={order.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>طلب <bdi className="tracking-wide">#{shortOrderId(order.id)}</bdi></span>
                <span aria-hidden="true">·</span>
                <time dateTime={order.createdAt}>{date.date}</time>
                {order.guest && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-accent">ضيف</span>}
              </div>
            </div>
          </div>

          <div className="mt-2 min-w-0 lg:ps-12">
            <p className="m-0 line-clamp-2 text-[13px] leading-6 text-foreground">
              {order.items.slice(0, 3).map(item => item.quantity + ' × ' + item.productName).join('، ')}
              {order.items.length > 3 ? '، وأصناف أخرى' : ''}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><DeliveryIcon size={13} aria-hidden="true" />{fulfillmentLabel(order)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 size={13} aria-hidden="true" />{date.time}</span>
              <span>{quantity} قطعة</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border bg-[var(--purple-50)]/50 px-4 py-3 lg:flex-col lg:items-stretch lg:justify-center lg:gap-3 lg:border-s lg:border-t-0 lg:px-3 lg:py-3">
          <div className="lg:text-center">
            <span className="mb-0.5 block text-[11px] text-muted-foreground">الإجمالي</span>
            <strong className="whitespace-nowrap text-base font-bold leading-7 text-primary">{money(Number(order.total))}</strong>
          </div>
          <Link
            href={'/orders/' + encodeURIComponent(order.id) + (isFinishedOrder(order.status) ? '' : '/tracking')}
            aria-label={(isFinishedOrder(order.status) ? 'تفاصيل طلب ' : 'تتبّع طلب ') + order.restaurantName + ' ' + shortOrderId(order.id)}
            className="inline-flex min-h-10 min-w-[148px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white no-underline transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {isFinishedOrder(order.status) ? 'تفاصيل الطلب' : 'تتبّع الطلب'}<ArrowLeft size={15} className="shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </MarketplaceCard>
  );
}

export function CustomerOrdersList({ embedded = false, heading }: { embedded?: boolean; heading?: ReactNode }) {
  const { session, query } = useCustomerOrders();
  const [filter, setFilter] = useState<OrderFilter>('all');
  const Root = embedded ? 'section' : 'main';
  const Container = embedded ? 'div' : MarketplaceContainer;
  const orders = [...(query.data?.pages.flatMap(page => page.items) ?? [])].sort((a, b) => Number(isFinishedOrder(a.status)) - Number(isFinishedOrder(b.status)) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const visible = orders.filter(order => filter === 'all' || (filter === 'past' ? isFinishedOrder(order.status) : !isFinishedOrder(order.status)));
  const loading = session.isPending || query.isPending;
  const counts = {
    all: orders.length,
    active: orders.filter(order => !isFinishedOrder(order.status)).length,
    past: orders.filter(order => isFinishedOrder(order.status)).length,
  };

  return (
    <Root id={embedded ? undefined : 'marketplace-main'} className={embedded ? 'min-w-0' : 'min-h-[65vh] pb-12 pt-6 sm:pt-8'}>
      <Container>
        <div className={embedded ? 'min-w-0' : 'mx-auto w-full max-w-[1040px]'}>
          {!embedded && <h1 className="sr-only">طلباتي</h1>}
          <div className="mb-2 flex min-h-9 items-center justify-between gap-4">
            {!embedded ? (
              <nav aria-label="مسار التنقل" className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <Link href="/" className="hover:text-accent">الرئيسية</Link><span aria-hidden="true">/</span><span aria-current="page">طلباتي</span>
              </nav>
            ) : <>{heading ?? <span className="sr-only">تحديث قائمة الطلبات</span>}</>}
            <MarketplaceButton
              type="button"
              disabled={query.isFetching || loading}
              onClick={() => void query.refetch()}
              aria-label="تحديث الطلبات"
              className="inline-flex size-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-white text-accent hover:bg-secondary sm:w-auto sm:px-3"
            >
              <RefreshCw size={15} aria-hidden="true" className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />
              <span className="hidden text-xs font-bold sm:inline">تحديث</span>
            </MarketplaceButton>
          </div>

          <div role="group" aria-label="تصفية الطلبات" className="mb-3 flex gap-3 overflow-x-auto border-b border-border sm:gap-5">
            {filters.map(tab => (
              <MarketplaceButton
                key={tab.id}
                type="button"
                aria-pressed={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={'relative inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-0.5 py-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent ' + (filter === tab.id ? 'border-primary font-bold text-primary' : 'border-transparent font-medium text-muted-foreground hover:text-primary')}
              >
                {tab.label}
                {!loading && !query.isError && <span title="عدد الطلبات المحمّلة في القسم" className={'min-w-5 rounded-md px-1.5 text-center text-[10px] leading-5 ' + (filter === tab.id ? 'bg-secondary text-accent' : 'bg-white text-muted-foreground')}>{counts[tab.id]}</span>}
              </MarketplaceButton>
            ))}
          </div>

          {!loading && !query.isError && (!session.data || orders.some(order => order.guest)) && <div className="mb-4"><GuestOrderNotice signedIn={Boolean(session.data)} /></div>}
          {!loading && !query.isError && filter === 'all' && counts.active > 0 && <h2 className="mb-3 mt-4 text-sm font-bold text-primary">طلباتك الجارية أولًا</h2>}
          {loading ? <CustomerOrdersSkeleton rows /> : query.isError ? (
            <CustomerOrderError error={query.error} retry={() => { void query.refetch(); }} />
          ) : visible.length ? (
            <ul className="m-0 grid list-none gap-3 p-0">
              {visible.map(order => <li key={order.id} className="min-w-0"><OrderPreview order={order} /></li>)}
            </ul>
          ) : <CustomerOrdersEmpty filtered={orders.length > 0} onReset={() => setFilter('all')} />}

          {query.hasNextPage && (
            <div className="mt-6 text-center">
              <MarketplaceButton type="button" tone="neutral" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} className="min-h-11 rounded-xl px-6 text-sm font-bold">
                {query.isFetchingNextPage ? 'جارٍ تحميل طلبات أقدم…' : 'تحميل طلبات أقدم'}
              </MarketplaceButton>
              <p className="mb-0 mt-2 text-xs text-muted-foreground">الأعداد والتصفية للطلبات المحمّلة حاليًا.</p>
            </div>
          )}
        </div>
      </Container>
    </Root>
  );
}
