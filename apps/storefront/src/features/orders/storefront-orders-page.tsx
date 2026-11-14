'use client';

import { useState } from 'react';
import Link from '../../components/storefront/storefront-link';
import { useParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { Button, useLocale } from '@waffarly/ui';
import { accountCopy } from '../account/account-copy';
import { AccountPreviewShell } from '../account/account-preview-shell';

type OrderFilter = 'all' | 'active' | 'past';

export function StorefrontOrdersPreviewPage() {
  const { locale } = useLocale();
  const params = useParams<{ slug: string }>();
  const t = accountCopy(locale);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const filters: { key: OrderFilter; label: string }[] = [
    { key: 'all', label: t.allOrders },
    { key: 'active', label: t.activeOrders },
    { key: 'past', label: t.pastOrders },
  ];

  return (
    <AccountPreviewShell active="orders" title={t.orders} description={t.ordersIntro}>
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

        <div
          aria-live="polite"
          className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-store-border bg-store-page px-5 py-9 text-center"
          key={filter}
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-white text-store-primary shadow-sm">
            <ClipboardList className="size-7" aria-hidden="true" />
          </span>
          <h3 className="font-heading text-storefront-subsection font-extrabold text-store-ink">
            {t.noOrdersTitle}
          </h3>
          <p className="max-w-xl text-storefront-support leading-5 text-store-secondary">
            {t.noOrdersDescription}
          </p>
          <Button
            asChild
            className="mt-1 min-h-11 bg-store-primary text-white hover:bg-store-primary-dark"
          >
            <Link href={`/s/${encodeURIComponent(params.slug)}/menu`}>{t.exploreMenu}</Link>
          </Button>
        </div>
      </section>
    </AccountPreviewShell>
  );
}
