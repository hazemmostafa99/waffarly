'use client';

import { useMemo, useState } from 'react';
import Link from '../../components/storefront/storefront-link';
import { useParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowDown, ClipboardList } from 'lucide-react';
import { Button, useLocale } from '@waffarly/ui';
import { accountCopy } from '../account/account-copy';
import { AccountPreviewShell } from '../account/account-preview-shell';
import {
  loadStorefrontCustomer,
  loadStorefrontCustomerOrders,
  storefrontCustomerOrdersKey,
  storefrontCustomerSessionKey,
} from '../account/data/storefront-customer-api';
import { formatStorefrontPrice } from '../../lib/storefront-format';

type OrderFilter = 'all' | 'active' | 'past';

function orderStatusLabel(status: string, locale: 'ar' | 'en') {
  const english: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  const arabic: Record<string, string> = {
    pending: 'قيد المراجعة',
    accepted: 'مقبول',
    rejected: 'مرفوض',
    preparing: 'قيد التحضير',
    ready: 'جاهز',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  };
  return (locale === 'ar' ? arabic : english)[status] ?? status;
}

export function StorefrontOrdersPage() {
  const { locale } = useLocale();
  const params = useParams<{ slug: string }>();
  const t = accountCopy(locale);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const session = useQuery({
    queryKey: storefrontCustomerSessionKey(params.slug),
    queryFn: () => loadStorefrontCustomer(params.slug),
    retry: false,
  });
  const orders = useInfiniteQuery({
    queryKey: storefrontCustomerOrdersKey(params.slug, session.data?.id),
    queryFn: ({ pageParam }) => loadStorefrontCustomerOrders(params.slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(session.data),
    retry: false,
  });
  const allOrders = useMemo(
    () => orders.data?.pages.flatMap((page) => page.items) ?? [],
    [orders.data],
  );
  const visibleOrders = allOrders.filter((order) => {
    if (filter === 'all') return true;
    const finished = ['rejected', 'completed', 'cancelled'].includes(order.status);
    return filter === 'past' ? finished : !finished;
  });
  const filters: { key: OrderFilter; label: string }[] = [
    { key: 'all', label: t.allOrders },
    { key: 'active', label: t.activeOrders },
    { key: 'past', label: t.pastOrders },
  ];

  return (
    <AccountPreviewShell
      active="orders"
      isPreview={false}
      title={t.orders}
      description={t.ordersIntro}
    >
      <section className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
            {t.orders}
          </h2>
          <div aria-label={t.filterLabel} className="flex flex-wrap gap-2" role="group">
            {filters.map(({ key, label }) => (
              <Button
                aria-pressed={filter === key}
                className={`min-h-11 ${filter === key ? 'bg-store-primary text-white hover:bg-store-primary-dark' : ''}`}
                key={key}
                onClick={() => setFilter(key)}
                type="button"
                variant={filter === key ? 'default' : 'outline'}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <p
          className="rounded-xl border border-store-gold/40 bg-store-cream px-4 py-3 text-storefront-support leading-5 text-store-secondary"
          role="note"
        >
          {t.filterNotice}
        </p>

        {session.isPending ? (
          <p
            role="status"
            className="rounded-xl bg-store-page p-4 text-storefront-support text-store-muted"
          >
            {t.loadingAccount}
          </p>
        ) : session.isError || orders.isError ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-storefront-support font-bold text-red-700"
          >
            {t.sessionError}
          </p>
        ) : !session.data ? (
          <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-store-border bg-store-page px-5 py-9 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-white text-store-primary shadow-sm">
              <ClipboardList className="size-7" aria-hidden="true" />
            </span>
            <h3 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
              {t.guestTitle}
            </h3>
            <p className="max-w-xl text-storefront-support leading-5 text-store-secondary">
              {t.guestDescription}
            </p>
            <Button
              asChild
              className="mt-1 min-h-11 bg-store-primary text-white hover:bg-store-primary-dark"
            >
              <Link href={`/s/${encodeURIComponent(params.slug)}/login`}>{t.signIn}</Link>
            </Button>
          </div>
        ) : orders.isPending ? (
          <p
            role="status"
            className="rounded-xl bg-store-page p-4 text-storefront-support text-store-muted"
          >
            {t.loadingAccount}
          </p>
        ) : visibleOrders.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-store-border bg-store-page px-5 py-9 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-white text-store-primary shadow-sm">
              <ClipboardList className="size-7" aria-hidden="true" />
            </span>
            <h3 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
              {t.noOrdersTitle}
            </h3>
            <p className="max-w-xl text-storefront-support leading-5 text-store-secondary">
              {orders.hasNextPage ? t.moreOrdersMayMatch : t.noOrdersDescription}
            </p>
            {orders.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                className="mt-1 min-h-11"
                disabled={orders.isFetchingNextPage}
                onClick={() => void orders.fetchNextPage()}
              >
                {orders.isFetchingNextPage ? t.loadingAccount : t.loadMore}
              </Button>
            ) : (
              <Button
                asChild
                className="mt-1 min-h-11 bg-store-primary text-white hover:bg-store-primary-dark"
              >
                <Link href={`/s/${encodeURIComponent(params.slug)}/menu`}>{t.exploreMenu}</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3" aria-live="polite">
            {visibleOrders.map((order) => (
              <article
                key={order.id}
                className="grid gap-3 rounded-2xl border border-store-border bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5"
              >
                <div className="grid gap-1">
                  <h3 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
                    {order.reference ?? order.id.slice(0, 8)}
                  </h3>
                  <p className="text-storefront-support text-store-muted">
                    {new Intl.DateTimeFormat(
                      locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn',
                      { dateStyle: 'medium', timeStyle: 'short' },
                    ).format(new Date(order.createdAt))}
                  </p>
                  <span className="w-fit rounded-full bg-store-cream px-3 py-1 text-storefront-caption font-bold text-store-primary-deep">
                    {orderStatusLabel(order.status, locale)}
                  </span>
                </div>
                <strong className="text-storefront-price text-store-ink">
                  {formatStorefrontPrice(order.total, locale)}
                </strong>
              </article>
            ))}
            {orders.hasNextPage && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 justify-self-center"
                disabled={orders.isFetchingNextPage}
                onClick={() => void orders.fetchNextPage()}
              >
                {orders.isFetchingNextPage ? (
                  t.loadingAccount
                ) : (
                  <>
                    <ArrowDown className="me-2 size-4" aria-hidden="true" />
                    {t.loadMore}
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </section>
    </AccountPreviewShell>
  );
}
