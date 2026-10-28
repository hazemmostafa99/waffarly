import { formatSubscriptionMoney } from './subscription-money.js';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ListFilter,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Store,
  X,
} from 'lucide-react';
import { Button, Input, useLocale } from '@waffarly/ui';
import type {
  SubscriptionDashboard,
  SubscriptionStatus,
  SubscriptionSummary,
} from '@waffarly/contracts';
import { PageHeader } from '../../components/PageHeader.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { apiRequest, apiRequestPage } from '../../lib/api-client.js';
import { useMonthlyPlansQuery } from '../plans/plans-queries.js';
import { subscriptionStatusLabels as labels } from './subscription-status.js';
import { SubscriptionEditor } from './SubscriptionEditor.js';
import './subscriptions.css';

const statuses: SubscriptionStatus[] = [
  'active',
  'pending',
  'suspended',
  'expired',
  'cancelled',
  'legacy',
];

export function SubscriptionsPage() {
  const { t, formatDate, formatNumber, errorText, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const [cursors, setCursors] = useState<string[]>([]);
  const merchantId = params.get('merchant') ?? '';
  const search = new URLSearchParams();
  for (const key of ['q', 'status', 'planId', 'expiring'])
    if (params.get(key)) search.set(key, params.get(key)!);
  if (cursors.at(-1)) search.set('cursor', cursors.at(-1)!);
  const plans = useMonthlyPlansQuery();
  const records = useQuery({
    queryKey: ['subscriptions', 'list', search.toString()],
    queryFn: () => apiRequestPage<SubscriptionSummary>(`/admin/subscriptions?${search}`),
    refetchInterval: 60000,
    enabled: !merchantId,
  });
  const dashboard = useQuery({
    queryKey: ['subscriptions', 'dashboard'],
    queryFn: () => apiRequest<SubscriptionDashboard>('/admin/subscriptions/dashboard'),
    refetchInterval: 60000,
  });
  function update(key: string, value: string) {
    setCursors([]);
    setParams(
      (before) => {
        const next = new URLSearchParams(before);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key === 'status') next.delete('expiring');
        return next;
      },
      { replace: key === 'q' },
    );
  }
  const hasFilters = ['q', 'status', 'planId', 'expiring'].some((key) => params.get(key));
  const stats = [
    {
      label: 'Active subscriptions',
      value: dashboard.data?.counts.active,
      icon: BadgeCheck,
      tone: 'mint',
      status: 'active',
      helper: 'Currently covered businesses',
    },
    {
      label: 'Expiring within 7 days',
      value: dashboard.data?.expiringSoon,
      icon: CalendarClock,
      tone: 'gold',
      status: 'expiring',
      helper: 'Follow up before coverage ends',
    },
    {
      label: 'Needs subscription review',
      value: dashboard.data?.counts.legacy,
      icon: ShieldAlert,
      tone: 'blue',
      status: 'legacy',
      helper: 'Existing access is preserved',
    },
  ];
  const money = (amount: string) => formatSubscriptionMoney(amount, locale);
  const showAll = () => update('merchant', '');
  return (
    <div className="subscription-page">
      <PageHeader
        title={t('Subscription management')}
        actions={
          <Button asChild variant="outline">
            <Link to="/plans">
              <Settings2 size={16} />
              {t('Subscription plans')}
            </Link>
          </Button>
        }
      />
      {dashboard.isError && (
        <p role="alert" className="subscription-alert">
          {errorText(dashboard.error.message)}
        </p>
      )}
      {!merchantId && (
        <div className="subscription-stats">
          {stats.map(({ icon: Icon, ...stat }) => (
            <button
              key={stat.label}
              type="button"
              className={`subscription-stat subscription-stat--${stat.tone}`}
              onClick={() => {
                if (stat.status === 'expiring') {
                  setCursors([]);
                  setParams((before) => {
                    const next = new URLSearchParams(before);
                    next.delete('status');
                    next.set('expiring', 'true');
                    return next;
                  });
                } else update('status', stat.status);
              }}
            >
              <span className="subscription-stat-icon">
                <Icon size={20} />
              </span>
              <span className="subscription-stat-copy">
                <span>{t(stat.label)}</span>
                <strong>{stat.value === undefined ? '—' : formatNumber(stat.value)}</strong>
                <small>{t(stat.helper)}</small>
              </span>
            </button>
          ))}
          <div className="subscription-stat subscription-stat--neutral">
            <span className="subscription-stat-icon">
              <CircleDollarSign size={20} />
            </span>
            <span className="subscription-stat-copy">
              <span>{t('Recorded external collections')}</span>
              <strong className="subscription-stat-money">
                {dashboard.data ? money(dashboard.data.collected) : '—'}
              </strong>
              <small>{t('Confirmed outside Waffarly')}</small>
            </span>
          </div>
        </div>
      )}
      {merchantId ? (
        <SubscriptionEditor key={merchantId} merchantId={merchantId} onClose={showAll} />
      ) : (
        <section
          className="subscription-surface subscription-list"
          aria-label={t('All subscriptions')}
        >
          <div className="subscription-list-header">
            <div>
              <h2>{t('All subscriptions')}</h2>
              <p>{t('Find a business and manage its subscription.')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={records.isFetching || dashboard.isFetching}
              onClick={() => {
                void records.refetch();
                void dashboard.refetch();
              }}
            >
              <RefreshCw size={15} className={records.isFetching ? 'animate-spin' : ''} />
              {t('Refresh')}
            </Button>
          </div>
          <div
            className="subscription-status-tabs"
            role="group"
            aria-label={t('Filter by subscription access')}
          >
            <button
              type="button"
              aria-pressed={!params.get('status') && !params.get('expiring')}
              onClick={() => update('status', '')}
            >
              {t('All statuses')}
              <span>
                {dashboard.data
                  ? formatNumber(Object.values(dashboard.data.counts).reduce((a, b) => a + b, 0))
                  : '—'}
              </span>
            </button>
            {statuses.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={params.get('status') === status}
                onClick={() => update('status', status)}
              >
                {t(labels[status])}
                <span>{dashboard.data ? formatNumber(dashboard.data.counts[status]) : '—'}</span>
              </button>
            ))}
          </div>
          <div className="subscription-filters">
            <label className="subscription-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">{t('Search businesses')}</span>
              <Input
                type="search"
                placeholder={t('Search by business, owner, or phone')}
                value={params.get('q') ?? ''}
                onChange={(e) => update('q', e.target.value)}
              />
            </label>
            <label className="subscription-filter-plan">
              <ListFilter size={16} aria-hidden="true" />
              <span className="sr-only">{t('Plan')}</span>
              <select
                value={params.get('planId') ?? ''}
                onChange={(e) => update('planId', e.target.value)}
              >
                <option value="">{t('All plans')}</option>
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCursors([]);
                  setParams({});
                }}
              >
                <X size={14} />
                {t('Clear filters')}
              </Button>
            )}
          </div>
          {params.get('expiring') && (
            <div className="subscription-filter-note">
              <CalendarClock size={15} />
              {t('Expiring within 7 days')}
            </div>
          )}
          {records.isError && (
            <p role="alert" className="subscription-alert">
              {errorText(records.error.message)}
            </p>
          )}
          <div className="subscription-table-scroll">
            <table className="admin-table" aria-busy={records.isFetching}>
              <thead>
                <tr>
                  {['Business', 'Plan', 'Status', 'Ends at', 'Actions'].map((h) => (
                    <th key={h}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.data?.items.map((s) => (
                  <tr key={s.merchantId}>
                    <td>
                      <div className="subscription-business">
                        <span className="subscription-business-avatar">
                          <Store size={17} />
                        </span>
                        <div>
                          <Link to={`/merchants/${s.merchantId}`}>{s.merchantName}</Link>
                          {!s.currentPeriod && <small>{t(labels[s.status])}</small>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.currentPeriod ? (
                        <>
                          <strong>{s.currentPeriod.planName}</strong>
                          <small>
                            {t('{{months}} months', { months: s.currentPeriod.months })}
                          </small>
                        </>
                      ) : (
                        (plans.data?.find((p) => p.id === s.assignedPlanId)?.name ?? (
                          <span className="subscription-muted">{t('Not assigned')}</span>
                        ))
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          s.status === 'active'
                            ? 'success'
                            : s.status === 'cancelled'
                              ? 'neutral'
                              : 'warning'
                        }
                      >
                        {t(labels[s.status])}
                      </StatusBadge>
                      {s.cancelAtEnd && <small>{t('Cancels at period end')}</small>}
                    </td>
                    <td>
                      {s.endsAt ? (
                        formatDate(s.endsAt)
                      ) : (
                        <span className="subscription-muted">{t('No end date')}</span>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => update('merchant', s.merchantId)}
                      >
                        {t('Manage subscription')}
                        {locale === 'ar' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {records.isPending && (
            <div className="subscription-list-empty" role="status">
              {t('Loading subscriptions…')}
            </div>
          )}
          {records.data?.items.length === 0 && (
            <div className="subscription-list-empty">
              <Search size={28} />
              <strong>{t('No subscriptions match these filters.')}</strong>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCursors([]);
                    setParams({});
                  }}
                >
                  {t('Clear filters')}
                </Button>
              )}
            </div>
          )}
          <footer className="subscription-list-footer">
            <span>
              {records.data
                ? t('{{count}} businesses on this page', { count: records.data.items.length })
                : '—'}
            </span>
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={!cursors.length}
                onClick={() => setCursors((s) => s.slice(0, -1))}
              >
                {t('Previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!records.data?.nextCursor}
                onClick={() => {
                  if (records.data?.nextCursor)
                    setCursors((s) => [...s, records.data!.nextCursor!]);
                }}
              >
                {t('Next')}
              </Button>
            </div>
          </footer>
        </section>
      )}
    </div>
  );
}
