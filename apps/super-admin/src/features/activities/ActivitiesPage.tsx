import { useMemo, useState } from 'react';
import { Activity, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { BusinessActivitySummary } from '@waffarly/contracts';
import { Button, Card, Input, useLocale, type LocalizedMessage } from '@waffarly/ui';
import { CompactStatCard } from '../../components/CompactStatCard.js';
import { PageHeader } from '../../components/PageHeader.js';
import { ActivityCatalogTable } from './ActivityCatalogTable.js';
import { ActivityEditorPanel } from './ActivityEditorPanel.js';
import { useBusinessActivitiesQuery } from './activity-queries.js';

export function ActivitiesPage() {
  const { t, errorText, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const activitiesQuery = useBusinessActivitiesQuery();
  const [editingActivity, setEditingActivity] = useState<BusinessActivitySummary | null>(null);
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const search = searchParams.get('q') ?? '';
  const normalizedSearch = search.trim().toLocaleLowerCase(locale);
  const allActivities = activitiesQuery.data ?? [];
  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn').format(value);

  function updateSearch(value: string) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }

  const activities = useMemo(() => {
    if (!normalizedSearch) return allActivities;
    return allActivities.filter((activity) =>
      [activity.key, activity.name, t(activity.name), activity.description, t(activity.description)]
        .join(' ')
        .toLocaleLowerCase(locale)
        .includes(normalizedSearch),
    );
  }, [allActivities, locale, normalizedSearch, t]);

  function openEditor(activity: BusinessActivitySummary) {
    setNotice('');
    setEditingActivity(activity);
  }

  function handleSaved(name: string) {
    setEditingActivity(null);
    setNotice({ key: '{{name}} updated.', values: { name } });
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={t('Business activities')}
        actions={
          <Button
            type="button"
            disabled={activitiesQuery.isFetching}
            onClick={() => void activitiesQuery.refetch()}
            className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover"
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={activitiesQuery.isFetching ? 'animate-spin' : ''}
            />
            {t('Refresh catalog')}
          </Button>
        }
      />

      {activitiesQuery.isError && (
        <div
          className="flex flex-wrap items-center justify-between admin-stack rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger"
          role="alert"
        >
          <div className="min-w-0">
            <strong className="block">{t('Could not load the activity catalog.')}</strong>
            <p className="mb-0 mt-1 text-xs">
              {errorText(
                activitiesQuery.error instanceof Error
                  ? activitiesQuery.error.message
                  : 'Something went wrong.',
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-waffarly-danger/20 bg-white text-waffarly-danger hover:bg-waffarly-danger-bg hover:text-waffarly-danger"
            onClick={() => void activitiesQuery.refetch()}
          >
            {t('Try again')}
          </Button>
        </div>
      )}

      {notice && (
        <p
          className="m-0 rounded-xl border border-waffarly-success/15 bg-waffarly-kpi-mint px-4 py-3 text-sm font-semibold text-waffarly-primary"
          role="status"
        >
          {t(notice)}
        </p>
      )}

      <section
        className="admin-stats-grid grid gap-3 sm:grid-cols-2"
        aria-label={t('Activity catalog summary')}
      >
        <CompactStatCard
          label={t('Business activities')}
          value={activitiesQuery.data ? formatCount(allActivities.length) : '—'}
          helper={t('Business categories supported by the platform.')}
          icon={Activity}
          tone="mint"
          loading={activitiesQuery.isPending}
        />
        <CompactStatCard
          label={t('Customized descriptions')}
          value={activitiesQuery.data ? formatCount(allActivities.filter((item) => item.revision > 0).length) : '—'}
          helper={t('Categories with administrator-edited display details.')}
          icon={ShieldCheck}
          tone="blue"
          loading={activitiesQuery.isPending}
        />
      </section>

      <div className="grid min-w-0 admin-stack xl:grid-cols-[minmax(0,1fr)_310px]">
        <Card
          className="admin-panel grid min-w-0 content-start admin-stack rounded-2xl border-waffarly-border bg-waffarly-surface text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]"
          aria-labelledby="activity-catalog-heading"
          aria-busy={activitiesQuery.isPending}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="activity-catalog-heading" className="m-0 text-base font-bold">
                {t('Business activity catalog')}
              </h2>
              <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
                {t('Review and edit the business categories available during onboarding.')}
              </p>
            </div>
            {activitiesQuery.data && (
              <span className="rounded-full bg-waffarly-kpi-mint px-3 py-1.5 text-xs font-bold text-waffarly-primary">
                {t('Showing {{visible}} of {{total}}', {
                  visible: formatCount(activities.length),
                  total: formatCount(allActivities.length),
                })}
              </span>
            )}
          </div>

          <label className="relative block">
            <span className="sr-only">{t('Search by activity name, key, or description')}</span>
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-waffarly-muted"
              aria-hidden="true"
            />
            <Input
              className="h-10 rounded-xl border-waffarly-border bg-white ps-10 pe-3 text-sm text-waffarly-ink placeholder:text-waffarly-muted"
              placeholder={t('Search by activity name, key, or description')}
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
            />
          </label>

          {activitiesQuery.isPending ? (
            <div
              className="h-64 animate-pulse rounded-xl bg-waffarly-input"
              role="status"
              aria-label={t('Loading activity catalog…')}
            />
          ) : activitiesQuery.isError && !activitiesQuery.data ? (
            <div className="grid min-h-40 place-content-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-8 text-center">
              <p className="m-0 text-sm text-waffarly-muted">{t('Activity catalog unavailable.')}</p>
            </div>
          ) : !activities.length ? (
            <div className="grid min-h-40 place-content-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-8 text-center">
              <h3 className="m-0 text-sm font-bold text-waffarly-ink">
                {t('No activities match this search')}
              </h3>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">
                {t('Try another activity name, key, or description.')}
              </p>
              {search.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 text-waffarly-primary"
                  onClick={() => updateSearch('')}
                >
                  {t('Clear activity search')}
                </Button>
              )}
            </div>
          ) : (
            <ActivityCatalogTable activities={activities} onEdit={openEditor} />
          )}
        </Card>

        {editingActivity ? (
          <ActivityEditorPanel
            key={`${editingActivity.key}-${editingActivity.revision}`}
            activity={editingActivity}
            onClose={() => setEditingActivity(null)}
            onSaved={handleSaved}
          />
        ) : (
          <Card className="admin-panel grid content-start admin-stack rounded-2xl border-waffarly-border bg-white text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
            <div>
              <span className="mb-3 grid size-9 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-info" aria-hidden="true">
                <ShieldCheck size={18} />
              </span>
              <h2 className="m-0 text-base font-bold">{t('About business activities')}</h2>
              <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
                {t('Activities classify businesses in onboarding and storefront discovery.')}
              </p>
            </div>
            <p className="m-0 text-xs leading-5 text-waffarly-muted">
              {t('Subscription status controls account access independently of the selected business activity.')}
            </p>
            <Link
              to="/merchants"
              className="inline-flex w-fit items-center gap-2 text-xs font-bold text-waffarly-primary underline-offset-4 hover:underline"
            >
              {t('View businesses')}
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
