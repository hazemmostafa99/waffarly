import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarClock, Clock3, Search, Store } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Input, useLocale } from '@waffarly/ui';
import type { MerchantSummary } from '@waffarly/contracts';
import { PageHeader } from '../../components/PageHeader.js';
import { StatCard } from '../../components/StatCard.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { useActivateFirstMonthMutation, useMerchantsQuery } from '../merchants/merchant-queries.js';

type AccessFilter = 'all' | 'activated' | 'awaiting';

function parseAccessFilter(value: string | null): AccessFilter {
  return value === 'activated' || value === 'awaiting' ? value : 'all';
}

export function SubscriptionsPage() {
  const { t, formatDate, errorText, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const merchants = useMerchantsQuery();
  const activateFirstMonth = useActivateFirstMonthMutation();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const search = searchParams.get('q') ?? '';
  const accessFilter = parseAccessFilter(searchParams.get('access'));

  function updateParams(updates: Record<string, string | null>) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, { replace: true });
  }

  function confirmActivation(merchant: MerchantSummary) {
    if (!window.confirm(t('Confirm that the first month was collected outside Waffarly for {{name}}?', { name: merchant.name }))) return;
    setFeedback(null);
    activateFirstMonth.mutate(merchant.id, {
      onSuccess: (updatedMerchant) => {
        setFeedback({ type: 'success', message: t('First month activated for {{name}}.', { name: updatedMerchant.name }) });
      },
      onError: (cause: unknown) => {
        setFeedback({ type: 'error', message: errorText(cause instanceof Error ? cause.message : 'Something went wrong.') });
      },
    });
  }

  const normalizedSearch = search.trim().toLocaleLowerCase(locale);
  const records = useMemo(() => (merchants.data ?? []).filter((merchant) => {
    const searchable = [merchant.name, merchant.ownerName, merchant.username, merchant.contactPhone, merchant.ownerMobile]
      .join(' ')
      .toLocaleLowerCase(locale);
    const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
    const activated = Boolean(merchant.firstMonthActivatedAt);
    const matchesAccess = accessFilter === 'all' || (accessFilter === 'activated' ? activated : !activated);
    return matchesSearch && matchesAccess;
  }), [accessFilter, locale, merchants.data, normalizedSearch]);

  const activatedCount = (merchants.data ?? []).filter((merchant) => merchant.firstMonthActivatedAt).length;
  const awaitingCount = (merchants.data?.length ?? 0) - activatedCount;
  const hasFilters = Boolean(search || accessFilter !== 'all');

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Plans & subscriptions')}
        title={t('Subscription access')}
        description={t('The current API records first-month activation only; plan assignment, later payments, renewal, and expiry details are not available here.')}
        actions={
          <Button asChild variant="outline" className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input">
            <Link to="/plans">{t('View monthly plans')}</Link>
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-2xl border border-waffarly-border bg-white px-4 py-4 shadow-[0_3px_12px_rgba(20,32,62,0.035)] md:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-info" aria-hidden="true">
          <CalendarClock size={18} />
        </span>
        <p className="m-0 text-sm leading-6 text-waffarly-muted">{t('Creating a business and recording first-month access are separate. Activation requires confirmation of collection outside Waffarly.')}</p>
      </div>

      {feedback && (
        <p className={`m-0 rounded-xl px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-waffarly-kpi-mint text-waffarly-primary' : 'bg-waffarly-danger-bg text-waffarly-danger'}`} role={feedback.type === 'success' ? 'status' : 'alert'}>
          {feedback.message}
        </p>
      )}

      {merchants.isError && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          <div className="min-w-0">
            <strong className="block">{t('Could not load access records.')}</strong>
            <p className="mb-0 mt-1 text-xs">{errorText(merchants.error instanceof Error ? merchants.error.message : 'Something went wrong.')}</p>
          </div>
          <Button variant="outline" size="sm" className="border-waffarly-border bg-white text-waffarly-primary" onClick={() => void merchants.refetch()}>
            {t('Try again')}
          </Button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('First-month access summary')}>
        <StatCard label={t('Businesses')} value={merchants.data?.length ?? '—'} helper={t('Businesses registered on Waffarly')} icon={Store} tone="mint" loading={merchants.isPending} />
        <StatCard label={t('First month activated')} value={merchants.data ? activatedCount : '—'} helper={t('Businesses with first-month activation recorded')} icon={BadgeCheck} tone="blue" loading={merchants.isPending} />
        <StatCard label={t('Awaiting first-month activation')} value={merchants.data ? awaitingCount : '—'} helper={t('Businesses awaiting first-month activation')} icon={Clock3} tone="gold" loading={merchants.isPending} />
      </section>

      <Card className="min-w-0 overflow-hidden rounded-2xl border-waffarly-border bg-waffarly-surface p-0 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-waffarly-border p-4 md:p-5">
          <div>
            <h2 className="m-0 text-sm font-bold">{t('First-month access records')}</h2>
            <p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('Filter the confirmed access fact currently available for each business.')}</p>
          </div>
          <span className="rounded-full bg-waffarly-kpi-mint px-3 py-1 text-xs font-bold text-waffarly-primary">{records.length} {t('records')}</span>
        </div>

        <div className="grid gap-3 border-b border-waffarly-border p-4 md:grid-cols-[minmax(220px,1fr)_minmax(170px,auto)_auto] md:items-end md:p-5">
          <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
            <span>{t('Search access records')}</span>
            <span className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-waffarly-muted" size={16} aria-hidden="true" />
              <Input
                type="search"
                className="h-10 rounded-xl border-waffarly-border bg-white ps-10 pe-3 text-sm text-waffarly-ink placeholder:text-waffarly-muted"
                placeholder={t('Search by business, owner, username, or phone')}
                value={search}
                onChange={(event) => updateParams({ q: event.target.value || null })}
              />
            </span>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
            <span>{t('First-month access')}</span>
            <select
              className="h-10 min-w-0 rounded-xl border border-waffarly-border bg-white px-3 text-sm font-medium text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary"
              value={accessFilter}
              onChange={(event) => updateParams({ access: event.target.value === 'all' ? null : event.target.value })}
              aria-label={t('Filter by first-month access')}
            >
              <option value="all">{t('All access states')}</option>
              <option value="activated">{t('First month activated')}</option>
              <option value="awaiting">{t('Awaiting first-month activation')}</option>
            </select>
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" type="button" className="h-10 justify-self-start px-2 text-waffarly-primary hover:bg-waffarly-kpi-mint hover:text-waffarly-primary md:justify-self-end" onClick={() => updateParams({ q: null, access: null })}>
              {t('Clear filters')}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto" role="region" aria-label={t('First-month access records')} tabIndex={0}>
          <table className="w-full min-w-[680px] border-collapse text-start text-sm" aria-busy={merchants.isPending}>
            <caption className="sr-only">{t('First-month access records')}</caption>
            <thead className="bg-waffarly-input text-[10px] font-bold uppercase tracking-wide text-waffarly-muted">
              <tr className="border-b border-waffarly-border">
                <th className="px-4 py-3 text-start" scope="col">{t('Business')}</th>
                <th className="px-4 py-3 text-start" scope="col">{t('Owner')}</th>
                <th className="px-4 py-3 text-start" scope="col">{t('First-month access')}</th>
                <th className="px-4 py-3 text-start" scope="col">{t('Activation date')}</th>
                <th className="px-4 py-3 text-end" scope="col">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {merchants.isPending ? (
                <tr><td className="px-4 py-12 text-center text-sm text-waffarly-muted" colSpan={5} role="status">{t('Loading access records…')}</td></tr>
              ) : merchants.isError && !merchants.data ? (
                <tr><td className="px-4 py-12 text-center text-sm text-waffarly-muted" colSpan={5}>{t('Access records are unavailable.')}</td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center" colSpan={5}>
                    <div className="grid justify-items-center gap-2">
                      <span className="grid size-11 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary"><Store size={20} aria-hidden="true" /></span>
                      <strong className="text-sm">{hasFilters ? t('No access records match these filters.') : t('No businesses yet')}</strong>
                      <p className="m-0 text-xs text-waffarly-muted">{hasFilters ? t('Try changing your search or filters.') : t('Businesses will appear here when they are created.')}</p>
                      {hasFilters && <Button variant="outline" size="sm" type="button" className="mt-1 border-waffarly-border bg-white text-waffarly-primary" onClick={() => updateParams({ q: null, access: null })}>{t('Clear filters')}</Button>}
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((merchant) => (
                  <tr className="border-b border-waffarly-border last:border-0" key={merchant.id}>
                    <td className="px-4 py-3.5">
                      <Link className="font-semibold text-waffarly-ink underline-offset-4 hover:text-waffarly-primary hover:underline" to={`/merchants/${merchant.id}`}>{merchant.name}</Link>
                      <small className="mt-1 block text-[11px] text-waffarly-muted" dir="ltr">{merchant.contactPhone}</small>
                    </td>
                    <td className="px-4 py-3.5">
                      <strong className="block text-xs font-semibold text-waffarly-ink">{merchant.ownerName}</strong>
                      <small className="mt-1 block text-[11px] text-waffarly-muted" dir="ltr">{merchant.ownerMobile}</small>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge tone={merchant.firstMonthActivatedAt ? 'success' : 'warning'}>
                        {merchant.firstMonthActivatedAt ? t('First month activated') : t('Awaiting first-month activation')}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-waffarly-muted">
                      {merchant.firstMonthActivatedAt ? formatDate(merchant.firstMonthActivatedAt) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-end">
                      {!merchant.firstMonthActivatedAt && (
                        <Button variant="outline" size="sm" type="button" disabled={activateFirstMonth.isPending} className="h-8 border-waffarly-border bg-white px-2.5 text-[11px] text-waffarly-primary hover:bg-waffarly-kpi-mint hover:text-waffarly-primary" onClick={() => confirmActivation(merchant)}>
                          {t('Activate first month')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
