import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  CircleCheck,
  Clock3,
  LayoutTemplate,
  Plus,
  Store,
  Tags,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BUSINESS_ACTIVITY_LABELS,
  type BusinessActivityKey,
  type StorefrontTemplateSummary,
} from '@waffarly/contracts';
import { Button, Card, useLocale } from '@waffarly/ui';
import { adminQueryKeys } from '../../app/query-keys.js';
import { PageHeader } from '../../components/PageHeader.js';
import { CompactStatCard } from '../../components/CompactStatCard.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { apiRequest } from '../../lib/api-client.js';
import {
  isPendingMerchantApplication,
  useMerchantApplicationsQuery,
  useMerchantsQuery,
} from '../merchants/merchant-queries.js';
import { useMonthlyPlansQuery } from '../plans/plans-queries.js';
import {
  merchantHasAccess,
  merchantSubscriptionStatus,
  subscriptionStatusLabels,
} from '../subscriptions/subscription-status.js';

function activityLabel(
  activity: BusinessActivityKey | undefined,
  translate: (value: string) => string,
) {
  return translate(BUSINESS_ACTIVITY_LABELS[activity ?? 'other']);
}

export function DashboardPage() {
  const { t, formatDate, errorText } = useLocale();
  const merchants = useMerchantsQuery();
  const applications = useMerchantApplicationsQuery();
  const plans = useMonthlyPlansQuery();
  const templates = useQuery({
    queryKey: adminQueryKeys.templates,
    queryFn: () => apiRequest<StorefrontTemplateSummary[]>('/admin/templates'),
    staleTime: 0,
  });

  const pendingApplications = (applications.data ?? []).filter(isPendingMerchantApplication);
  const recentMerchants = [...(merchants.data ?? [])]
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .slice(0, 5);
  const failures = [merchants, applications, plans, templates].filter((query) => query.isError);
  const dashboardLoading = [merchants, applications, plans, templates].some(
    (query) => query.isPending,
  );

  return (
    <div className="admin-page">
      <PageHeader
        title={t('Platform overview')}
        actions={
          <Button
            className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover"
            asChild
          >
            <Link to="/merchants">
              <Plus size={16} aria-hidden="true" />
              {t('Manage businesses')}
            </Link>
          </Button>
        }
      />

      {failures.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between admin-stack rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger"
          role="alert"
        >
          <div className="min-w-0">
            <strong className="block">{t('Some overview data could not be loaded.')}</strong>
            <p className="mb-0 mt-1 text-xs">
              {errorText(
                failures[0]?.error instanceof Error
                  ? failures[0].error.message
                  : 'Something went wrong.',
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink"
            onClick={() => void Promise.all(failures.map((query) => query.refetch()))}
          >
            {t('Try again')}
          </Button>
        </div>
      )}

      <section
        className="admin-stats-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t('Platform summary')}
      >
        <CompactStatCard
          label={t('Businesses')}
          value={merchants.data?.length ?? '—'}
          helper={t('Businesses registered on Waffarly')}
          icon={Building2}
          tone="mint"
          loading={merchants.isPending}
        />
        <CompactStatCard
          label={t('Awaiting review')}
          value={applications.data ? pendingApplications.length : '—'}
          helper={t('Applications awaiting an admin decision')}
          icon={Clock3}
          tone="gold"
          loading={applications.isPending}
        />
        <CompactStatCard
          label={t('Businesses with access')}
          value={merchants.data?.filter(merchantHasAccess).length ?? '—'}
          helper={t('Active subscriptions and preserved existing access')}
          icon={CircleCheck}
          tone="blue"
          loading={merchants.isPending}
        />
        <CompactStatCard
          label={t('Available storefronts')}
          value={
            templates.data?.filter((template) => template.status === 'available').length ?? '—'
          }
          helper={t('Designs currently available to merchants')}
          icon={LayoutTemplate}
          tone="purple"
          loading={templates.isPending}
        />
      </section>

      <div className="grid admin-stack xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
        <Card className="admin-panel-flush min-w-0 overflow-hidden rounded-2xl border-waffarly-border bg-waffarly-surface text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
          <div className="admin-section flex items-start justify-between admin-stack border-b border-waffarly-border">
            <div>
              <h2 className="m-0 text-sm font-bold">{t('Recently added businesses')}</h2>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">
                {t('The latest businesses created on the platform.')}
              </p>
            </div>
            <Link
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-waffarly-primary hover:underline"
              to="/merchants"
            >
              {t('View businesses')} <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {merchants.isPending ? (
            <div
              className="admin-section grid gap-3"
              role="status"
              aria-label={t('Loading businesses')}
            >
              {Array.from({ length: 4 }, (_, index) => (
                <span className="h-12 animate-pulse rounded-lg bg-waffarly-input" key={index} />
              ))}
            </div>
          ) : recentMerchants.length === 0 ? (
            <div className="grid justify-items-center px-5 py-12 text-center">
              <span className="mb-3 grid size-11 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary">
                <Store size={20} />
              </span>
              <strong className="text-sm">{t('No businesses yet')}</strong>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">
                {t('Businesses will appear here when they are created.')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table w-full min-w-[650px] border-collapse text-start text-xs">
                <thead className="bg-waffarly-input text-[10px] font-bold uppercase tracking-wide text-waffarly-muted">
                  <tr className="border-b border-waffarly-border">
                    <th className="px-4 py-3 text-start">{t('Business')}</th>
                    <th className="px-4 py-3 text-start">{t('Activity')}</th>
                    <th className="px-4 py-3 text-start">{t('Owner')}</th>
                    <th className="px-4 py-3 text-start">{t('Access')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMerchants.map((merchant) => (
                    <tr className="border-b border-waffarly-border last:border-0" key={merchant.id}>
                      <td>
                        <strong className="block px-4 pt-3 font-semibold text-waffarly-ink">
                          {merchant.name}
                        </strong>
                        <small className="block px-4 pb-3 pt-1 text-[10px] text-waffarly-muted">
                          {formatDate(merchant.createdAt)}
                        </small>
                      </td>
                      <td className="px-4 py-3 text-waffarly-muted">
                        {activityLabel(merchant.activity, t)}
                      </td>
                      <td className="px-4 py-3 text-waffarly-muted">{merchant.ownerName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={merchantHasAccess(merchant) ? 'success' : 'warning'}>
                          {t(subscriptionStatusLabels[merchantSubscriptionStatus(merchant)])}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {merchants.isError && (
            <p
              className="m-4 rounded-lg bg-waffarly-danger-bg p-3 text-xs text-waffarly-danger"
              role="alert"
            >
              {errorText(merchants.error.message)}
            </p>
          )}
        </Card>

        <div className="grid content-start admin-stack">
          <Card className="admin-panel-flush overflow-hidden rounded-2xl border-waffarly-border bg-waffarly-surface text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
            <div className="admin-section flex items-start justify-between admin-stack border-b border-waffarly-border">
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
                <span className="h-12 animate-pulse rounded-lg bg-waffarly-input" />
                <span className="h-12 animate-pulse rounded-lg bg-waffarly-input" />
              </div>
            ) : pendingApplications.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 text-xs font-medium text-waffarly-success">
                <CircleCheck size={20} aria-hidden="true" />
                <span>{t('You are all caught up.')}</span>
              </div>
            ) : (
              <ul className="m-0 grid list-none p-0">
                {pendingApplications.slice(0, 4).map((application) => (
                  <li
                    className="border-b border-waffarly-border last:border-0"
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
                          {activityLabel(application.activity, t)} ·{' '}
                          {formatDate(application.createdAt)}
                        </small>
                      </span>
                      <ChevronRight
                        className="shrink-0 text-waffarly-muted rtl:rotate-180"
                        size={16}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {applications.isError && (
              <p
                className="m-4 rounded-lg bg-waffarly-danger-bg p-3 text-xs text-waffarly-danger"
                role="alert"
              >
                {errorText(applications.error.message)}
              </p>
            )}
            <Link
              className="flex items-center justify-between border-t border-waffarly-border px-4 py-3 text-xs font-semibold text-waffarly-primary hover:bg-waffarly-input"
              to="/applications"
            >
              {t('Review applications')} <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </Card>

          <Card className="admin-panel-flush overflow-hidden rounded-2xl border-waffarly-border bg-waffarly-surface text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
            <div className="admin-section border-b border-waffarly-border">
              <div>
                <h2 className="m-0 text-sm font-bold">{t('Platform catalog')}</h2>
                <p className="mb-0 mt-1 text-xs text-waffarly-muted">
                  {t('Manage the information shown to merchants.')}
                </p>
              </div>
            </div>
            <Link
              to="/plans"
              className="flex items-center gap-3 border-b border-waffarly-border px-4 py-3 transition-colors hover:bg-waffarly-input"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-gold text-waffarly-gold">
                <Tags size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-xs font-semibold">{t('Monthly plans')}</strong>
                <small className="mt-1 block truncate text-[10px] text-waffarly-muted">
                  {plans.data
                    ? t('{{count}} plans configured', { count: plans.data.length })
                    : t('Open plan catalog')}
                </small>
              </span>
              <ArrowUpRight className="text-waffarly-muted" size={15} />
            </Link>
            <Link
              to="/templates"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-waffarly-input"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary">
                <LayoutTemplate size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-xs font-semibold">{t('Storefront designs')}</strong>
                <small className="mt-1 block truncate text-[10px] text-waffarly-muted">
                  {templates.data
                    ? t('{{count}} designs in library', { count: templates.data.length })
                    : t('Open design library')}
                </small>
              </span>
              <ArrowUpRight className="text-waffarly-muted" size={15} />
            </Link>
          </Card>
        </div>
      </div>
      {dashboardLoading && (
        <span className="sr-only" role="status">
          {t('Loading platform overview…')}
        </span>
      )}
    </div>
  );
}
