import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Store,
  Users,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BUSINESS_ACTIVITY_KEYS,
  BUSINESS_ACTIVITY_LABELS,
  type BusinessActivityKey,
  type MerchantSummary,
} from '@waffarly/contracts';
import { Button, Card, Input, useLocale } from '@waffarly/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { CompactStatCard } from '../../components/CompactStatCard.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { CreatedMerchantDialog } from './CreatedMerchantDialog.js';
import { useCreatedMerchantStore } from './created-merchant-store.js';
import {
  merchantHasAccess,
  merchantSubscriptionStatus,
  subscriptionStatusLabels,
} from '../subscriptions/subscription-status.js';
import {
  isPendingMerchantApplication,
  useMerchantApplicationsQuery,
  useMerchantsQuery,
} from './merchant-queries.js';

const PAGE_SIZE = 10;
type AccessFilter = 'all' | 'activated' | 'awaiting';

function formatMerchantDate(value: string) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('/');
}

function isBusinessActivityKey(value: string | null): value is BusinessActivityKey {
  return value !== null && BUSINESS_ACTIVITY_KEYS.some((key) => key === value);
}

function accessStatus(merchant: MerchantSummary, translate: (key: string) => string) {
  return {
    label: translate(subscriptionStatusLabels[merchantSubscriptionStatus(merchant)]),
    tone: merchantHasAccess(merchant) ? ('success' as const) : ('warning' as const),
  };
}

export function MerchantsPage() {
  const { t, formatDate, errorText, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const merchants = useMerchantsQuery();
  const applications = useMerchantApplicationsQuery();
  const [createdMerchant, setCreatedMerchant] = useState(
    () => useCreatedMerchantStore.getState().result,
  );

  useEffect(() => {
    useCreatedMerchantStore.getState().setResult(null);
  }, []);

  const businessQuery = searchParams.get('q') ?? '';
  const requestedActivity = searchParams.get('activity');
  const activityFilter = isBusinessActivityKey(requestedActivity) ? requestedActivity : 'all';
  const requestedAccess = searchParams.get('access');
  const accessFilter: AccessFilter =
    requestedAccess === 'activated' || requestedAccess === 'awaiting' ? requestedAccess : 'all';
  const parsedPage = Number(searchParams.get('page') ?? '1');
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  function updateParams(updates: Record<string, string | null>, replace = true) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace },
    );
  }

  const normalizedQuery = businessQuery.trim().toLocaleLowerCase(locale);
  const filteredMerchants = useMemo(
    () =>
      (merchants.data ?? [])
        .filter((merchant) => {
          const searchable = [
            merchant.name,
            merchant.ownerName,
            merchant.contactPhone,
            merchant.ownerMobile,
            merchant.username,
            t(BUSINESS_ACTIVITY_LABELS[merchant.activity ?? 'other']),
          ]
            .join(' ')
            .toLocaleLowerCase(locale);
          const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
          const matchesActivity =
            activityFilter === 'all' || (merchant.activity ?? 'other') === activityFilter;
          const hasActivated = merchantHasAccess(merchant);
          const matchesAccess =
            accessFilter === 'all' ||
            (accessFilter === 'activated' && hasActivated) ||
            (accessFilter === 'awaiting' && !hasActivated);
          return matchesQuery && matchesActivity && matchesAccess;
        })
        .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
    [accessFilter, activityFilter, locale, merchants.data, normalizedQuery, t],
  );

  const pendingApplications = (applications.data ?? []).filter(isPendingMerchantApplication);
  const pageCount = Math.max(1, Math.ceil(filteredMerchants.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const pageMerchants = filteredMerchants.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activatedCount = (merchants.data ?? []).filter(merchantHasAccess).length;
  const awaitingCount = (merchants.data ?? []).length - activatedCount;
  const hasFilters = Boolean(businessQuery || activityFilter !== 'all' || accessFilter !== 'all');

  return (
    <div className="admin-page">
      <CreatedMerchantDialog result={createdMerchant} onClose={() => setCreatedMerchant(null)} />
      <PageHeader
        title={t('Businesses')}
        actions={
          <Button
            asChild
            className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover"
          >
            <Link to="/merchants/new">
              <Store size={16} aria-hidden="true" />
              {t('Create a business')}
            </Link>
          </Button>
        }
      />

      {(merchants.isError || applications.isError) && (
        <div
          className="flex flex-wrap items-center justify-between admin-stack rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger"
          role="alert"
        >
          <div className="min-w-0">
            <strong className="block">{t('Some business data could not be loaded.')}</strong>
            <p className="mb-0 mt-1 text-xs">
              {errorText(
                merchants.error instanceof Error
                  ? merchants.error.message
                  : applications.error instanceof Error
                    ? applications.error.message
                    : 'Something went wrong.',
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink"
            onClick={() => void Promise.all([merchants.refetch(), applications.refetch()])}
          >
            {t('Try again')}
          </Button>
        </div>
      )}

      <section
        className="admin-stats-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label={t('Business summary')}
      >
        <CompactStatCard
          label={t('Businesses')}
          value={merchants.data?.length ?? '—'}
          helper={t('Businesses registered on Waffarly')}
          icon={Store}
          tone="mint"
          loading={merchants.isPending}
        />
        <CompactStatCard
          label={t('Businesses with access')}
          value={merchants.data ? activatedCount : '—'}
          helper={t('Active subscriptions and preserved existing access')}
          icon={Users}
          tone="blue"
          loading={merchants.isPending}
        />
        <CompactStatCard
          label={t('Restricted businesses')}
          value={merchants.data ? awaitingCount : '—'}
          helper={t('Businesses without active subscription access')}
          icon={Clock3}
          tone="gold"
          loading={merchants.isPending}
        />
      </section>

      <div className="grid items-start admin-stack 2xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)]">
        <Card className="admin-panel-flush min-w-0 overflow-hidden rounded-2xl border-waffarly-border bg-waffarly-surface text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
          <div className="admin-section flex flex-wrap items-start justify-between admin-stack border-b border-waffarly-border">
            <div>
              <h2 className="m-0 text-sm font-bold">{t('Registered businesses')}</h2>
            </div>
            <span className="rounded-full bg-waffarly-kpi-mint px-3 py-1 text-xs font-bold text-waffarly-primary">
              {merchants.data?.length ?? '—'} {t('Businesses')}
            </span>
          </div>

          <div className="admin-section grid grid-cols-2 gap-3 border-b border-waffarly-border md:grid-cols-[minmax(220px,1fr)_minmax(160px,auto)_minmax(170px,auto)_auto] md:items-end">
            <label className="col-span-2 grid gap-1.5 text-xs font-semibold text-waffarly-ink md:col-span-1">
              <span>{t('Search businesses')}</span>
              <span className="relative">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-waffarly-muted"
                  size={16}
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  className="h-10 rounded-xl border-waffarly-border bg-white ps-10 pe-3 text-sm text-waffarly-ink placeholder:text-waffarly-muted"
                  placeholder={t('Search by business, owner, or phone')}
                  value={businessQuery}
                  onChange={(event) => updateParams({ q: event.target.value || null, page: null })}
                />
              </span>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
              <span>{t('Business activity')}</span>
              <select
                className="h-10 min-w-0 rounded-xl border border-waffarly-border bg-white px-3 text-sm font-medium text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary"
                value={activityFilter}
                onChange={(event) =>
                  updateParams({
                    activity: event.target.value === 'all' ? null : event.target.value,
                    page: null,
                  })
                }
                aria-label={t('Filter by business activity')}
              >
                <option value="all">{t('All business activities')}</option>
                {BUSINESS_ACTIVITY_KEYS.map((activity) => (
                  <option key={activity} value={activity}>
                    {t(BUSINESS_ACTIVITY_LABELS[activity])}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
              <span>{t('Subscription status')}</span>
              <select
                className="h-10 min-w-0 rounded-xl border border-waffarly-border bg-white px-3 text-sm font-medium text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary"
                value={accessFilter}
                onChange={(event) =>
                  updateParams({
                    access: event.target.value === 'all' ? null : event.target.value,
                    page: null,
                  })
                }
                aria-label={t('Filter by subscription access')}
              >
                <option value="all">{t('All access states')}</option>
                <option value="activated">{t('Businesses with access')}</option>
                <option value="awaiting">{t('Restricted businesses')}</option>
              </select>
            </label>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="h-10 justify-self-start px-2 text-waffarly-primary hover:bg-waffarly-kpi-mint hover:text-waffarly-primary md:justify-self-end"
                onClick={() => updateParams({ q: null, activity: null, access: null, page: null })}
              >
                {t('Clear filters')}
              </Button>
            )}
          </div>

          <div
            className="overflow-x-auto"
            role="region"
            aria-label={t('Registered businesses')}
            tabIndex={0}
          >
            <table
              className="admin-table w-full min-w-[880px] table-fixed border-collapse text-start text-sm"
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
              aria-busy={merchants.isPending}
            >
              <caption className="sr-only">{t('Registered businesses')}</caption>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '27%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '19%' }} />
              </colgroup>
              <thead className="bg-[#f7f9fb] text-xs font-semibold text-[#607286]">
                <tr className="border-b border-waffarly-border">
                  <th className="whitespace-nowrap px-5 py-3.5 text-start" scope="col">
                    {t('Business')}
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-start" scope="col">
                    {t('Activity')}
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-start" scope="col">
                    {t('Contacts')}
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-start" scope="col">
                    {t('Subscription status')}
                  </th>
                  <th className="whitespace-nowrap px-5 py-3.5 text-start" scope="col">
                    {t('Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {merchants.isPending ? (
                  <tr>
                    <td
                      className="px-4 py-12 text-center text-sm text-waffarly-muted"
                      colSpan={5}
                      role="status"
                    >
                      {t('Loading businesses')}
                    </td>
                  </tr>
                ) : merchants.isError && !merchants.data ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-sm text-waffarly-muted" colSpan={5}>
                      {t('Business records are unavailable.')}
                    </td>
                  </tr>
                ) : pageMerchants.length === 0 ? (
                  <tr>
                    <td className="px-4 py-12 text-center" colSpan={5}>
                      {merchants.data?.length ? (
                        <div className="grid justify-items-center gap-2">
                          <strong className="text-sm">
                            {t('No businesses match these filters.')}
                          </strong>
                          <p className="m-0 text-xs text-waffarly-muted">
                            {t('Try changing your search or filters.')}
                          </p>
                          {hasFilters && (
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              className="mt-1 border-waffarly-border bg-white text-waffarly-primary hover:bg-waffarly-kpi-mint hover:text-waffarly-primary"
                              onClick={() =>
                                updateParams({ q: null, activity: null, access: null, page: null })
                              }
                            >
                              {t('Clear filters')}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="grid justify-items-center gap-2">
                          <span className="grid size-11 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary">
                            <Store size={20} aria-hidden="true" />
                          </span>
                          <strong className="text-sm">{t('No businesses yet')}</strong>
                          <p className="m-0 text-xs text-waffarly-muted">
                            {t('Businesses will appear here when they are created.')}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  pageMerchants.map((merchant) => {
                    const status = accessStatus(merchant, t);
                    return (
                      <tr
                        className="border-b border-waffarly-border bg-white transition-colors hover:bg-[#fcfefd] last:border-0"
                        key={merchant.id}
                      >
                        <td className="px-5 py-5 align-middle">
                          <div className="min-w-0 text-start">
                            <Link
                              to={`/merchants/${merchant.id}`}
                              className="block truncate text-start text-[13px] font-bold text-waffarly-ink underline-offset-4 hover:text-waffarly-primary hover:underline"
                            >
                              <bdi dir="auto">{merchant.name}</bdi>
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-5 text-[#607286]">
                              <span>{t('Added')}</span>
                              <time
                                dateTime={merchant.createdAt}
                                dir="ltr"
                                className="tabular-nums"
                              >
                                {formatMerchantDate(merchant.createdAt)}
                              </time>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-5 align-middle text-[13px] text-waffarly-ink">
                          {t(BUSINESS_ACTIVITY_LABELS[merchant.activity ?? 'other'])}
                        </td>
                        <td className="px-5 py-5 align-middle">
                          <div className="flex min-w-0 flex-col items-start gap-1 text-start">
                            <span className="text-[13px] font-medium tabular-nums text-waffarly-ink">
                              <bdi dir="ltr">{merchant.contactPhone}</bdi>
                            </span>
                            <span className="text-[11px] leading-4 text-[#607286]">
                              {t('Owner')}: <bdi dir="auto">{merchant.ownerName}</bdi>
                            </span>
                            {merchant.ownerMobile !== merchant.contactPhone && (
                              <span className="text-[11px] leading-4 text-[#607286]">
                                {t('Owner mobile number')}:{' '}
                                <bdi dir="ltr">{merchant.ownerMobile}</bdi>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-5 align-middle">
                          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                          {merchant.firstMonthActivatedAt && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[11px] leading-4 text-[#607286]">
                              <span>{t('Activation date')}</span>
                              <time
                                dateTime={merchant.firstMonthActivatedAt}
                                dir="ltr"
                                className="tabular-nums"
                              >
                                {formatMerchantDate(merchant.firstMonthActivatedAt)}
                              </time>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-5 align-middle">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-10 whitespace-nowrap rounded-xl border-waffarly-border bg-white px-3 text-xs font-bold text-waffarly-ink hover:border-waffarly-success/30 hover:bg-waffarly-kpi-mint/30 hover:text-waffarly-primary"
                          >
                            <Link to={`/subscriptions?merchant=${merchant.id}`}>
                              {t('Manage subscription')}
                              {locale === 'ar' ? (
                                <ChevronLeft size={15} aria-hidden="true" />
                              ) : (
                                <ChevronRight size={15} aria-hidden="true" />
                              )}
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!merchants.isPending && filteredMerchants.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-waffarly-border px-4 py-3 md:px-5">
              <span className="text-xs text-waffarly-muted" role="status">
                {t('Showing {{start}}–{{end}} of {{total}} businesses', {
                  start: (page - 1) * PAGE_SIZE + 1,
                  end: Math.min(page * PAGE_SIZE, filteredMerchants.length),
                  total: filteredMerchants.length,
                })}
              </span>
              {pageCount > 1 && (
                <nav className="flex items-center gap-2" aria-label={t('Business list pages')}>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input"
                    disabled={page <= 1}
                    onClick={() =>
                      updateParams({ page: page <= 2 ? null : String(page - 1) }, false)
                    }
                  >
                    <ArrowLeft className="rtl:rotate-180" size={14} aria-hidden="true" />
                    {t('Previous')}
                  </Button>
                  <span
                    className="min-w-20 text-center text-xs font-semibold text-waffarly-ink"
                    aria-current="page"
                  >
                    {t('Page {{page}} of {{pages}}', { page, pages: pageCount })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input"
                    disabled={page >= pageCount}
                    onClick={() => updateParams({ page: String(page + 1) }, false)}
                  >
                    {t('Next')}
                    <ArrowRight className="rtl:rotate-180" size={14} aria-hidden="true" />
                  </Button>
                </nav>
              )}
            </div>
          )}
        </Card>

        <Card className="admin-panel-flush overflow-hidden rounded-2xl border-waffarly-border bg-waffarly-surface text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
          <div className="admin-section flex items-start justify-between gap-3 border-b border-waffarly-border">
            <div>
              <h2 className="m-0 text-sm font-bold">{t('Applications to review')}</h2>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">
                {t('Pending merchant applications.')}
              </p>
            </div>
            <span className="grid min-w-8 place-items-center rounded-full bg-waffarly-gold-light px-2 py-1 text-xs font-bold text-waffarly-ink">
              {applications.data ? pendingApplications.length : '—'}
            </span>
          </div>
          {applications.isPending ? (
            <div
              className="admin-section grid gap-3"
              role="status"
              aria-label={t('Loading applications')}
            >
              <span className="h-10 animate-pulse rounded-lg bg-waffarly-input" />
              <span className="h-10 animate-pulse rounded-lg bg-waffarly-input" />
            </div>
          ) : applications.isError ? (
            <p
              className="m-4 rounded-lg bg-waffarly-danger-bg p-3 text-xs text-waffarly-danger"
              role="alert"
            >
              {errorText(applications.error.message)}
            </p>
          ) : pendingApplications.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-5 text-xs font-medium text-waffarly-success">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-waffarly-kpi-mint">
                <Users size={16} aria-hidden="true" />
              </span>
              <span>{t('You are all caught up.')}</span>
            </div>
          ) : (
            <ul className="m-0 grid list-none p-0">
              {pendingApplications.slice(0, 5).map((application) => (
                <li
                  className="min-w-0 border-b border-waffarly-border last:border-0"
                  key={application.id}
                >
                  <Link
                    to={`/applications?application=${encodeURIComponent(application.id)}`}
                    className="flex min-w-0 items-center gap-2.5 px-4 py-3 text-inherit hover:bg-waffarly-input focus-visible:outline-2 focus-visible:outline-waffarly-primary"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-waffarly-gold-light text-xs font-bold text-waffarly-ink"
                      aria-hidden="true"
                    >
                      {application.name.trim().slice(0, 1).toLocaleUpperCase() || 'W'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-semibold">
                        {application.name}
                      </strong>
                      <small className="mt-1 block truncate text-[10px] text-waffarly-muted">
                        {t(BUSINESS_ACTIVITY_LABELS[application.activity ?? 'other'])} ·{' '}
                        {formatDate(application.createdAt)}
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            className="flex items-center justify-between border-t border-waffarly-border px-4 py-3 text-xs font-semibold text-waffarly-primary hover:bg-waffarly-input"
            to="/applications"
          >
            {t('Review applications')}
            <ArrowRight className="rtl:rotate-180" size={15} aria-hidden="true" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
