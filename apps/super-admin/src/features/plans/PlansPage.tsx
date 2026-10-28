import { Button, Card, DataTable, useLocale, type LocalizedMessage } from '@waffarly/ui';
import { Pencil, Plus, RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { MonthlyPlanSummary } from '@waffarly/contracts';
import { PageHeader } from '../../components/PageHeader.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { useMonthlyPlansQuery } from './plans-queries.js';

function planNoticeFromState(state: unknown): LocalizedMessage {
  if (!state || typeof state !== 'object' || !('planNotice' in state)) return '';
  const notice = (state as { planNotice?: unknown }).planNotice;
  if (typeof notice === 'string') return notice;
  if (notice && typeof notice === 'object' && 'key' in notice && typeof notice.key === 'string') {
    return notice as LocalizedMessage;
  }
  return '';
}

export function PlansPage() {
  const { t, errorText, locale, formatDate } = useLocale();
  const location = useLocation();
  const plans = useMonthlyPlansQuery();
  const savedPlans = plans.data ?? [];
  const planNotice = planNoticeFromState(location.state);
  const price = (amount: string, currency: string) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  const columns = [
    {
      id: 'name',
      header: t('Plan name'),
      cell: (plan: MonthlyPlanSummary) => (
        <div className="grid gap-0.5">
          <Link
            to={`/plans/${plan.id}/edit`}
            className="font-bold text-waffarly-ink hover:text-waffarly-primary hover:underline"
          >
            <bdi>{plan.name}</bdi>
          </Link>
          <span className="text-[11px] text-waffarly-muted">
            {t('Updated')} {formatDate(plan.updatedAt)}
          </span>
          {plan.description && (
            <span className="max-w-64 text-xs text-waffarly-muted">{plan.description}</span>
          )}
        </div>
      ),
    },
    {
      id: 'availability',
      header: t('Availability'),
      cell: (plan: MonthlyPlanSummary) => (
        <StatusBadge tone={plan.available === false ? 'warning' : 'info'}>
          {t(plan.available === false ? 'Unavailable' : 'Available')}
        </StatusBadge>
      ),
    },
    {
      id: 'monthly-price',
      header: t('Monthly price'),
      cell: (plan: MonthlyPlanSummary) => (
        <bdi className="font-semibold tabular-nums">{price(plan.monthlyPrice, plan.currency)}</bdi>
      ),
    },
    ...([3, 6, 12, 24] as const).map((months) => ({
      id: `term-${months}`,
      header: t('{{months}} months', { months }),
      cell: (plan: MonthlyPlanSummary) => {
        const term = plan.terms?.find((item) => item.months === months);
        return term ? (
          <bdi className="tabular-nums">{price(term.price, plan.currency)}</bdi>
        ) : (
          <span className="text-waffarly-muted">—</span>
        );
      },
    })),
    {
      id: 'actions',
      header: t('Actions'),
      cell: (plan: MonthlyPlanSummary) => (
        <Button variant="outline" size="sm" asChild>
          <Link to={`/plans/${plan.id}/edit`} aria-label={t('Edit {{name}}', { name: plan.name })}>
            <Pencil size={14} aria-hidden="true" />
            {t('Edit plan')}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <PageHeader
        title={t('Subscription plans')}
        actions={
          <>
            <Button
              variant="outline"
              type="button"
              disabled={plans.isFetching}
              onClick={() => void plans.refetch()}
            >
              <RefreshCw
                size={15}
                aria-hidden="true"
                className={plans.isFetching ? 'animate-spin' : ''}
              />
              {t('Refresh plans')}
            </Button>
            <Button asChild>
              <Link to="/plans/new">
                <Plus size={15} aria-hidden="true" />
                {t('Create plan')}
              </Link>
            </Button>
          </>
        }
      />

      {planNotice && (
        <p
          className="m-0 rounded-lg bg-waffarly-kpi-mint px-3 py-2 text-xs text-waffarly-primary"
          role="status"
        >
          {t(planNotice)}
        </p>
      )}

      {plans.isError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-waffarly-danger/20 bg-waffarly-danger-bg px-3 py-2 text-xs text-waffarly-danger"
          role="alert"
        >
          <span>
            <strong>{t('Could not load plans.')}</strong>{' '}
            {errorText(
              plans.error instanceof Error ? plans.error.message : 'Something went wrong.',
            )}
          </span>
          <Button variant="outline" size="sm" onClick={() => void plans.refetch()}>
            {t('Try again')}
          </Button>
        </div>
      )}

      <Card
        className="admin-panel-flush overflow-hidden border-waffarly-border"
        aria-labelledby="plan-list-heading"
        aria-busy={plans.isPending}
      >
        <div className="admin-section flex flex-wrap items-center justify-between gap-2 border-b border-waffarly-border">
          <h2 id="plan-list-heading" className="m-0 text-sm font-bold">
            {t('Plan catalog')}
          </h2>
          <span className="text-xs text-waffarly-muted" aria-live="polite">
            {plans.isPending ? '—' : `${savedPlans.length} ${t('plans')}`}
          </span>
        </div>
        <DataTable
          className="admin-table-scroll admin-plans-table-wrap"
          caption={t('Plan catalog')}
          columns={columns}
          rows={savedPlans}
          rowKey={(plan) => plan.id}
          loading={plans.isPending}
          loadingState={t('Loading plans…')}
          emptyState={
            plans.isError ? (
              t('Could not load plans.')
            ) : (
              <div className="grid justify-items-center gap-2 py-4">
                <strong>{t('No plans yet')}</strong>
                <span>{t('Create a plan and set its duration prices.')}</span>
                <Button asChild size="sm">
                  <Link to="/plans/new">
                    <Plus size={14} aria-hidden="true" />
                    {t('Create plan')}
                  </Link>
                </Button>
              </div>
            )
          }
        />
      </Card>
      <p className="admin-inline-note">
        {t('Plan definitions do not change merchant access, subscriptions, or collected payments.')}
      </p>
    </div>
  );
}
