import { Button, Card, useLocale, type LocalizedMessage } from '@waffarly/ui';
import { ArrowDownUp, CircleDollarSign, Pencil, Plus, RefreshCw, Tags } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { MonthlyPlanSummary } from '@waffarly/contracts';
import { PageHeader } from '../../components/PageHeader.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { useMonthlyPlansQuery } from './plans-queries.js';

function planNoticeFromState(state: unknown): LocalizedMessage {
  if (!state || typeof state !== 'object' || !('planNotice' in state)) return '';
  const notice = (state as { planNotice?: unknown }).planNotice;
  if (typeof notice === 'string') return notice;
  if (
    notice &&
    typeof notice === 'object' &&
    'key' in notice &&
    typeof notice.key === 'string'
  ) {
    return notice as LocalizedMessage;
  }
  return '';
}

function PlanCard({ plan }: { plan: MonthlyPlanSummary }) {
  const { t, locale, formatDate } = useLocale();
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-waffarly-border bg-white p-4 transition-shadow hover:shadow-[0_5px_20px_rgba(20,32,62,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 break-words text-sm font-bold text-waffarly-ink">{plan.name}</h3>
          <StatusBadge tone="info">{t('Monthly')}</StatusBadge>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-info" aria-hidden="true">
          <CircleDollarSign size={18} />
        </span>
      </div>
      <p className="mb-0 mt-5 flex flex-wrap items-baseline gap-x-1.5">
        <strong className="text-2xl font-extrabold tracking-tight text-waffarly-ink">
          {new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
            style: 'currency',
            currency: plan.currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(Number(plan.monthlyPrice))}
        </strong>
        <span className="text-xs text-waffarly-muted">{t('/ month')}</span>
      </p>
      <p className="mb-0 mt-3 min-h-10 text-xs leading-5 text-waffarly-muted">
        {plan.description || t('No description provided.')}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-waffarly-border pt-3">
        <span className="text-[11px] text-waffarly-muted">{t('Updated')} {formatDate(plan.updatedAt)}</span>
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink"
        >
          <Link to={`/plans/${plan.id}/edit`} aria-label={t('Edit {{name}}', { name: plan.name })}>
            <Pencil size={14} aria-hidden="true" />
            {t('Edit plan')}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function PlansPage() {
  const { t, errorText } = useLocale();
  const location = useLocation();
  const plans = useMonthlyPlansQuery();
  const savedPlans = plans.data ?? [];
  const planNotice = planNoticeFromState(location.state);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Plans & subscriptions')}
        title={t('Monthly plans')}
        description={t('Set the monthly offer for your business merchants.')}
        actions={
          <>
            <Button
              variant="outline"
              className="border-waffarly-border bg-waffarly-surface text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink"
              type="button"
              disabled={plans.isFetching}
              onClick={() => void plans.refetch()}
            >
              <RefreshCw size={16} aria-hidden="true" className={plans.isFetching ? 'animate-spin' : ''} />
              {t('Refresh plans')}
            </Button>
            <Button asChild className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover">
              <Link to="/plans/new">
                <Plus size={16} aria-hidden="true" />
                {t('Create a monthly plan')}
              </Link>
            </Button>
          </>
        }
      />

      {planNotice && (
        <p className="m-0 rounded-xl bg-waffarly-kpi-mint px-4 py-3 text-sm font-medium text-waffarly-primary" role="status">
          {t(planNotice)}
        </p>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-waffarly-border bg-white px-4 py-4 shadow-[0_3px_12px_rgba(20,32,62,0.035)] md:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-info" aria-hidden="true">
          <ArrowDownUp size={18} />
        </span>
        <p className="m-0 text-sm leading-6 text-waffarly-muted">{t('Plan definitions do not change merchant access, subscriptions, or collected payments.')}</p>
      </div>

      {plans.isError && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          <div className="min-w-0">
            <strong className="block">{t('Could not load plans.')}</strong>
            <p className="mb-0 mt-1 text-xs">
              {errorText(plans.error instanceof Error ? plans.error.message : 'Something went wrong.')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-waffarly-danger/20 bg-white text-waffarly-danger hover:bg-waffarly-danger-bg hover:text-waffarly-danger"
            onClick={() => void plans.refetch()}
          >
            {t('Try again')}
          </Button>
        </div>
      )}

      <Card className="grid gap-5 border-waffarly-border p-5 shadow-[0_3px_12px_rgba(20,32,62,0.035)] md:p-6" aria-labelledby="plan-list-heading" aria-busy={plans.isPending}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary" aria-hidden="true">
              <Tags size={19} />
            </span>
            <div>
              <h2 id="plan-list-heading" className="m-0 text-lg font-bold text-waffarly-ink">{t('Plan catalog')}</h2>
              <p className="mb-0 mt-0.5 text-xs text-waffarly-muted">{t('Monthly offers configured for the platform')}</p>
            </div>
          </div>
          <span className="rounded-full bg-waffarly-input px-3 py-1.5 text-xs font-bold text-waffarly-muted" aria-live="polite">
            {plans.isPending ? '—' : `${savedPlans.length} ${t('plans')}`}
          </span>
        </div>

        {plans.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label={t('Loading plans…')}>
            {[0, 1].map((item) => (
              <div key={item} className="min-h-44 animate-pulse rounded-2xl border border-waffarly-border bg-waffarly-input/70 p-4">
                <div className="h-4 w-2/3 rounded bg-white" />
                <div className="mt-5 h-8 w-1/2 rounded bg-white" />
                <div className="mt-4 h-3 w-full rounded bg-white" />
              </div>
            ))}
          </div>
        ) : plans.isError && !plans.data ? null : savedPlans.length === 0 ? (
          <div className="grid min-h-52 place-content-center justify-items-center rounded-2xl border border-dashed border-waffarly-border bg-waffarly-input/40 px-6 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-waffarly-kpi-gold text-waffarly-ink" aria-hidden="true">
              <CircleDollarSign size={21} />
            </span>
            <h3 className="mb-0 mt-3 text-sm font-bold text-waffarly-ink">{t('No plans yet')}</h3>
            <p className="mb-0 mt-1 max-w-xs text-xs leading-5 text-waffarly-muted">{t('Create a monthly plan to start building the catalog.')}</p>
            <Button asChild size="sm" className="mt-4 bg-waffarly-primary text-white hover:bg-waffarly-primary-hover">
              <Link to="/plans/new"><Plus size={14} aria-hidden="true" />{t('Create plan')}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {savedPlans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
          </div>
        )}
      </Card>
    </div>
  );
}
