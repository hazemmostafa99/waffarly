import { useMemo } from 'react';
import { useState } from 'react';
import { Activity, Boxes, Network, RefreshCw, Search, ShieldCheck, Store, Tags } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { BusinessActivitySummary } from '@waffarly/contracts';
import { Button, Card, Input, useLocale, type LocalizedMessage } from '@waffarly/ui';
import { CompactStatCard } from '../../components/CompactStatCard.js';
import { PageHeader } from '../../components/PageHeader.js';
import { ActivityCard } from './ActivityCard.js';
import { ActivityCatalogTable } from './ActivityCatalogTable.js';
import { ActivityEditorPanel } from './ActivityEditorPanel.js';
import { useActivitiesModulesCatalogQuery } from '../activity-modules/activity-modules-queries.js';

export function ActivitiesPage() {
  const { t, errorText, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalog = useActivitiesModulesCatalogQuery();
  const [editingActivity, setEditingActivity] = useState<BusinessActivitySummary | null>(null);
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const search = searchParams.get('q') ?? '';
  const normalizedSearch = search.trim().toLocaleLowerCase(locale);
  const formatCount = (value: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn').format(value);
  const allActivities = catalog.data?.activities ?? [];
  const allModules = catalog.data?.modules ?? [];

  function updateSearch(value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set('q', value);
      else next.delete('q');
      return next;
    }, { replace: true });
  }

  function openEditor(activity: BusinessActivitySummary) {
    setNotice('');
    setEditingActivity(activity);
  }

  function closeEditor() {
    setEditingActivity(null);
  }

  function handleSaved(name: string) {
    setEditingActivity(null);
    setNotice({ key: '{{name}} updated.', values: { name } });
  }

  const activities = useMemo(() => {
    if (!normalizedSearch) return allActivities;

    return allActivities.filter((activity) => {
      const associatedModules = activity.moduleKeys
        .map((key) => allModules.find((module) => module.key === key))
        .filter((module) => module !== undefined)
        .flatMap((module) => [module.key, module.name, t(module.name), module.description, t(module.description)]);
      const supportedModules = allModules
        .filter((module) => module.supportedActivities.includes(activity.key))
        .flatMap((module) => [module.key, module.name, t(module.name)]);
      return [
        activity.key,
        activity.name,
        t(activity.name),
        activity.description,
        t(activity.description),
        ...associatedModules,
        ...supportedModules,
      ].join(' ').toLocaleLowerCase(locale).includes(normalizedSearch);
    });
  }, [allActivities, allModules, locale, normalizedSearch, t]);

  const codeSupportedPairs = allModules.reduce(
    (sum, module) => sum + allActivities.filter((activity) => module.supportedActivities.includes(activity.key)).length,
    0,
  );
  const catalogAssociations = allActivities.reduce((sum, activity) => sum + activity.moduleKeys.length, 0);
  const hasSearch = Boolean(search.trim());

  return (
    <div className="admin-page">
      <PageHeader
        title={t('Business activities')}
        actions={(
          <Button
            type="button"
            disabled={catalog.isFetching}
            onClick={() => void catalog.refetch()}
            className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover"
          >
            <RefreshCw size={15} aria-hidden="true" className={catalog.isFetching ? 'animate-spin' : ''} />
            {t('Refresh catalog')}
          </Button>
        )}
      />

      {catalog.isError && (
        <div className="flex flex-wrap items-center justify-between admin-stack rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          <div className="min-w-0">
            <strong className="block">{t('Could not load the activity catalog.')}</strong>
            <p className="mb-0 mt-1 text-xs">{errorText(catalog.error instanceof Error ? catalog.error.message : 'Something went wrong.')}</p>
          </div>
          <Button variant="outline" size="sm" className="border-waffarly-danger/20 bg-white text-waffarly-danger hover:bg-waffarly-danger-bg hover:text-waffarly-danger" onClick={() => void catalog.refetch()}>
            {t('Try again')}
          </Button>
        </div>
      )}

      {notice && (
        <p className="m-0 rounded-xl border border-waffarly-success/15 bg-waffarly-kpi-mint px-4 py-3 text-sm font-semibold text-waffarly-primary" role="status">
          {t(notice)}
        </p>
      )}

      <section className="admin-stats-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('Activity catalog summary')}>
        <CompactStatCard label={t('Business activities')} value={catalog.data ? formatCount(allActivities.length) : '—'} helper={t('Activity types currently returned by the platform catalog.')} icon={Activity} tone="mint" loading={catalog.isPending} />
        <CompactStatCard label={t('Platform modules')} value={catalog.data ? formatCount(allModules.length) : '—'} helper={t('Modules currently defined in code')} icon={Boxes} tone="blue" loading={catalog.isPending} />
        <CompactStatCard label={t('Code-supported pairs')} value={catalog.data ? formatCount(codeSupportedPairs) : '—'} helper={t('Module and activity pairs allowed by code')} icon={Network} tone="gold" loading={catalog.isPending} />
        <CompactStatCard label={t('Catalog associations')} value={catalog.data ? formatCount(catalogAssociations) : '—'} helper={t('Activity-module links currently saved')} icon={Tags} tone="purple" loading={catalog.isPending} />
      </section>

      <section className="grid gap-3" aria-labelledby="activity-types-heading" aria-busy={catalog.isPending}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="activity-types-heading" className="m-0 text-sm font-bold text-waffarly-ink">{t('Business activity types')}</h2>
            <p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('Activity types currently returned by the platform catalog.')}</p>
          </div>
          {catalog.data && (
            <span className="rounded-full bg-waffarly-kpi-mint px-3 py-1.5 text-[11px] font-bold text-waffarly-primary" aria-live="polite">
              {t('Showing {{visible}} of {{total}}', { visible: formatCount(activities.length), total: formatCount(allActivities.length) })}
            </span>
          )}
        </div>

        {catalog.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label={t('Loading activity catalog…')}>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-2xl border border-waffarly-border bg-waffarly-input p-3" />
            ))}
          </div>
        ) : catalog.isError && !catalog.data ? (
          <div className="grid min-h-32 place-content-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-6 text-center">
            <p className="m-0 text-sm text-waffarly-muted">{t('Activity catalog unavailable.')}</p>
          </div>
        ) : !allActivities.length ? (
          <div className="grid min-h-36 place-content-center justify-items-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-6 text-center">
            <span className="grid size-10 place-items-center rounded-xl bg-waffarly-kpi-gold text-waffarly-gold" aria-hidden="true"><Activity size={19} /></span>
            <h3 className="mb-0 mt-3 text-sm font-bold text-waffarly-ink">{t('No business activities configured')}</h3>
            <p className="mb-0 mt-1 max-w-sm text-xs leading-5 text-waffarly-muted">{t('No business activities are configured in the catalog yet.')}</p>
          </div>
        ) : !activities.length ? (
          <div className="grid min-h-32 place-content-center justify-items-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-6 text-center">
            <span className="grid size-9 place-items-center rounded-xl bg-waffarly-input text-waffarly-muted" aria-hidden="true"><Search size={16} /></span>
            <h3 className="mb-0 mt-2 text-sm font-bold text-waffarly-ink">{t('No activities match this search')}</h3>
            <p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('Try another name, key, description, or module.')}</p>
            {hasSearch && <Button variant="ghost" size="sm" className="mt-1 text-waffarly-primary" onClick={() => updateSearch('')}>{t('Clear activity search')}</Button>}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {activities.map((activity) => <ActivityCard key={activity.key} activity={activity} modules={allModules} />)}
          </div>
        )}
      </section>

      <div className="grid min-w-0 admin-stack xl:grid-cols-[minmax(0,1fr)_310px]">
        <Card className="admin-panel grid min-w-0 content-start admin-stack rounded-2xl border-waffarly-border bg-waffarly-surface text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]" aria-labelledby="activity-catalog-heading" aria-busy={catalog.isPending}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="activity-catalog-heading" className="m-0 text-base font-bold">{t('Business activity catalog')}</h2>
              <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Review platform support separately from the modules saved in each activity.')}</p>
            </div>
            <span className="rounded-full bg-waffarly-kpi-mint px-3 py-1.5 text-xs font-bold text-waffarly-primary" aria-live="polite">
              {t('Showing {{visible}} of {{total}}', { visible: formatCount(activities.length), total: formatCount(allActivities.length) })}
            </span>
          </div>

          <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
            <span>{t('Search activities')}</span>
            <span className="relative block max-w-xl">
              <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-waffarly-muted" size={16} aria-hidden="true" />
              <Input
                type="search"
                className="h-10 rounded-xl border-waffarly-border bg-white ps-10 pe-3 text-sm text-waffarly-ink placeholder:text-waffarly-muted"
                placeholder={t('Search by activity name, key, description, or compatible module')}
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
              />
            </span>
          </label>

          {catalog.isPending ? (
            <div className="h-64 animate-pulse rounded-xl bg-waffarly-input" role="status" aria-label={t('Loading activity catalog…')} />
          ) : catalog.isError && !catalog.data ? (
            <div className="grid min-h-40 place-content-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-8 text-center">
              <p className="m-0 text-sm text-waffarly-muted">{t('Activity catalog unavailable.')}</p>
            </div>
          ) : !activities.length ? (
            <div className="grid min-h-40 place-content-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-8 text-center">
              <h3 className="m-0 text-sm font-bold text-waffarly-ink">{t('No activities match this search')}</h3>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('Try another name, key, description, or module.')}</p>
            </div>
          ) : (
            <ActivityCatalogTable activities={activities} modules={allModules} onEdit={openEditor} />
          )}
        </Card>

        {editingActivity ? (
          <ActivityEditorPanel key={`${editingActivity.key}-${editingActivity.revision}`} activity={editingActivity} modules={allModules} onClose={closeEditor} onSaved={handleSaved} />
        ) : <Card className="admin-panel grid content-start admin-stack rounded-2xl border-waffarly-border bg-white text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]" aria-labelledby="activity-definition-heading">
          <div>
            <span className="mb-3 grid size-9 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-info" aria-hidden="true"><ShieldCheck size={18} /></span>
            <h2 id="activity-definition-heading" className="m-0 text-base font-bold">{t('Standard definition')}</h2>
            <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Keep business categories separate from platform features and access rules.')}</p>
          </div>

          <dl className="m-0 grid divide-y divide-waffarly-border">
            <div className="py-3 first:pt-0">
              <dt className="text-xs font-bold text-waffarly-ink">{t('Business activity')}</dt>
              <dd className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('The business category selected for a merchant, such as restaurant or clothing.')}</dd>
            </div>
            <div className="py-3">
              <dt className="text-xs font-bold text-waffarly-ink">{t('Platform module')}</dt>
              <dd className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('An application capability that may support one or more business activities.')}</dd>
            </div>
            <div className="py-3">
              <dt className="text-xs font-bold text-waffarly-ink">{t('Plan entitlement')}</dt>
              <dd className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('A plan benefit is managed separately; activity compatibility does not assign it.')}</dd>
            </div>
            <div className="py-3 last:pb-0">
              <dt className="text-xs font-bold text-waffarly-ink">{t('User permission')}</dt>
              <dd className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Permissions determine what a person may do and are not inferred from activity type.')}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-waffarly-success/15 bg-waffarly-kpi-mint/60 p-3">
            <p className="m-0 text-[11px] leading-5 text-waffarly-ink">{t('Adding a category does not deploy application capabilities or create database tables by itself.')}</p>
          </div>

          <Link to="/modules" className="inline-flex w-fit items-center gap-2 text-xs font-bold text-waffarly-primary underline-offset-4 hover:underline">
            <Store size={14} aria-hidden="true" />
            {t('Review platform modules')}
          </Link>
        </Card>}
      </div>
    </div>
  );
}
