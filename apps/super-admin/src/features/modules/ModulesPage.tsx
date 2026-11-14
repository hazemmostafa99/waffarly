import { useMemo } from 'react';
import {
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Tags,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { BusinessActivitySummary, PlatformModuleSummary } from '@waffarly/contracts';
import { Button, Card, Input, useLocale } from '@waffarly/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { CompactStatCard } from '../../components/CompactStatCard.js';
import { useActivitiesModulesCatalogQuery } from '../activity-modules/activity-modules-queries.js';
import { ModuleCompatibilityMatrix } from './ModuleCompatibilityMatrix.js';

type RelationFilter = 'all' | 'associated' | 'supported-only' | 'mismatch' | 'unsupported';

const relationFilters: RelationFilter[] = [
  'all',
  'associated',
  'supported-only',
  'mismatch',
  'unsupported',
];

function matchesRelation(
  module: PlatformModuleSummary,
  activities: BusinessActivitySummary[],
  relation: RelationFilter,
) {
  if (relation === 'all') return true;
  const pairs = activities.map((activity) => ({
    supported: module.supportedActivities.includes(activity.key),
    associated: activity.moduleKeys.includes(module.key),
  }));

  if (relation === 'associated') return pairs.some((pair) => pair.associated && pair.supported);
  if (relation === 'supported-only')
    return pairs.some((pair) => pair.supported && !pair.associated);
  if (relation === 'mismatch') return pairs.some((pair) => pair.associated && !pair.supported);
  return pairs.some((pair) => !pair.supported && !pair.associated);
}

export function ModulesPage() {
  const { t, errorText, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalog = useActivitiesModulesCatalogQuery();
  const search = searchParams.get('q') ?? '';
  const activityKey = searchParams.get('activity') ?? 'all';
  const rawRelation = searchParams.get('relation') as RelationFilter | null;
  const relation = rawRelation && relationFilters.includes(rawRelation) ? rawRelation : 'all';
  const normalizedSearch = search.trim().toLocaleLowerCase(locale);
  const formatCount = (value: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn').format(value);
  const allActivities = catalog.data?.activities ?? [];
  const allModules = catalog.data?.modules ?? [];
  const selectedActivity = allActivities.find((activity) => activity.key === activityKey);

  function updateFilter(key: 'q' | 'activity' | 'relation', value: string) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!value || value === 'all') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchParams({}, { replace: true });
  }

  const modules = useMemo(
    () =>
      allModules.filter((module) => {
        if (selectedActivity) {
          const supported = module.supportedActivities.includes(selectedActivity.key);
          const associated = selectedActivity.moduleKeys.includes(module.key);
          const matchesActivityRelation =
            relation === 'all' ||
            (relation === 'associated' && associated && supported) ||
            (relation === 'supported-only' && supported && !associated) ||
            (relation === 'mismatch' && associated && !supported) ||
            (relation === 'unsupported' && !supported && !associated);
          if (!matchesActivityRelation) return false;
        } else if (!matchesRelation(module, allActivities, relation)) {
          return false;
        }

        if (!normalizedSearch) return true;
        const supportedActivityNames = module.supportedActivities
          .map((key) => allActivities.find((activity) => activity.key === key))
          .filter((activity) => activity !== undefined)
          .flatMap((activity) => [activity.name, t(activity.name)]);
        const associationNames = allActivities
          .filter((activity) => activity.moduleKeys.includes(module.key))
          .flatMap((activity) => [activity.name, t(activity.name)]);
        const dependencies = module.dependencies.map(
          (key) => allModules.find((item) => item.key === key)?.name ?? key,
        );
        return [
          module.key,
          module.name,
          t(module.name),
          module.description,
          t(module.description),
          ...supportedActivityNames,
          ...associationNames,
          ...dependencies,
        ]
          .join(' ')
          .toLocaleLowerCase(locale)
          .includes(normalizedSearch);
      }),
    [allActivities, allModules, locale, normalizedSearch, relation, selectedActivity, t],
  );

  const supportedPairs = allModules.reduce(
    (sum, module) =>
      sum +
      allActivities.filter((activity) => module.supportedActivities.includes(activity.key)).length,
    0,
  );
  const associatedPairs = allActivities.reduce(
    (sum, activity) => sum + activity.moduleKeys.length,
    0,
  );
  const hasFilters = Boolean(search.trim()) || activityKey !== 'all' || relation !== 'all';

  return (
    <div className="admin-page">
      <PageHeader
        title={t('Modules and platform capabilities')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/activities"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-waffarly-primary px-4 text-xs font-bold text-white transition hover:bg-waffarly-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary/30"
            >
              <Store size={15} aria-hidden="true" />
              {t('Review business activities')}
            </Link>
            <Button
              variant="outline"
              type="button"
              disabled={catalog.isFetching}
              onClick={() => void catalog.refetch()}
              className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink"
            >
              <RefreshCw
                size={15}
                aria-hidden="true"
                className={catalog.isFetching ? 'animate-spin' : ''}
              />
              {t('Refresh catalog')}
            </Button>
          </div>
        }
      />

      {catalog.isError && (
        <div
          className="flex flex-wrap items-center justify-between admin-stack rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger"
          role="alert"
        >
          <div className="min-w-0">
            <strong className="block">{t('Could not load the modules matrix.')}</strong>
            <p className="mb-0 mt-1 text-xs">
              {errorText(
                catalog.error instanceof Error ? catalog.error.message : 'Something went wrong.',
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-waffarly-danger/20 bg-white text-waffarly-danger hover:bg-waffarly-danger-bg hover:text-waffarly-danger"
            onClick={() => void catalog.refetch()}
          >
            {t('Try again')}
          </Button>
        </div>
      )}

      <section
        className="admin-stats-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t('Modules matrix summary')}
      >
        <CompactStatCard
          label={t('Platform modules')}
          value={catalog.data ? formatCount(allModules.length) : '—'}
          helper={t('Modules currently defined in code')}
          icon={Boxes}
          tone="mint"
          loading={catalog.isPending}
        />
        <CompactStatCard
          label={t('Business activities')}
          value={catalog.data ? formatCount(allActivities.length) : '—'}
          helper={t('Activity columns returned by the catalog')}
          icon={Store}
          tone="blue"
          loading={catalog.isPending}
        />
        <CompactStatCard
          label={t('Code-supported pairs')}
          value={catalog.data ? formatCount(supportedPairs) : '—'}
          helper={t('Module and activity pairs allowed by code')}
          icon={Network}
          tone="purple"
          loading={catalog.isPending}
        />
        <CompactStatCard
          label={t('Catalog associations')}
          value={catalog.data ? formatCount(associatedPairs) : '—'}
          helper={t('Activity-module links currently saved')}
          icon={Tags}
          tone="gold"
          loading={catalog.isPending}
        />
      </section>

      <section
        className="grid gap-2 rounded-2xl border border-waffarly-border bg-white p-2.5 shadow-[0_3px_12px_rgba(20,32,62,0.035)] md:grid-cols-[minmax(240px,1fr)_220px_220px]"
        aria-label={t('Filter modules')}
      >
        <label className="relative block min-w-0">
          <span className="sr-only">{t('Search modules')}</span>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-waffarly-muted"
            size={16}
            aria-hidden="true"
          />
          <Input
            type="search"
            className="h-10 rounded-xl border-waffarly-border bg-waffarly-input/50 ps-10 pe-3 text-sm text-waffarly-ink placeholder:text-waffarly-muted focus-visible:bg-white"
            placeholder={t('Search by module name, key, description, or activity')}
            value={search}
            onChange={(event) => updateFilter('q', event.target.value)}
          />
        </label>
        <label className="relative block">
          <span className="sr-only">{t('Filter by activity')}</span>
          <select
            aria-label={t('Filter by activity')}
            className="h-10 w-full appearance-none rounded-xl border border-waffarly-border bg-white px-3 text-sm text-waffarly-ink outline-none transition focus-visible:ring-2 focus-visible:ring-waffarly-primary/20"
            value={selectedActivity?.key ?? 'all'}
            onChange={(event) => updateFilter('activity', event.target.value)}
          >
            <option value="all">{t('All business activities')}</option>
            {allActivities.map((activity) => (
              <option key={activity.key} value={activity.key}>
                {t(activity.name)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-waffarly-muted"
            size={15}
            aria-hidden="true"
          />
        </label>
        <label className="relative block">
          <span className="sr-only">{t('Filter by relationship')}</span>
          <select
            aria-label={t('Filter by relationship')}
            className="h-10 w-full appearance-none rounded-xl border border-waffarly-border bg-white px-3 text-sm text-waffarly-ink outline-none transition focus-visible:ring-2 focus-visible:ring-waffarly-primary/20"
            value={relation}
            onChange={(event) => updateFilter('relation', event.target.value)}
          >
            <option value="all">{t('All relationships')}</option>
            <option value="associated">{t('Associated in catalog')}</option>
            <option value="supported-only">{t('Supported by code, not associated')}</option>
            <option value="mismatch">{t('Catalog mismatch')}</option>
            <option value="unsupported">{t('Not supported')}</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-waffarly-muted"
            size={15}
            aria-hidden="true"
          />
        </label>
      </section>

      <div className="grid min-w-0 admin-stack xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card
          className="admin-panel grid min-w-0 content-start admin-stack rounded-2xl border-waffarly-border bg-waffarly-surface text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]"
          aria-labelledby="module-matrix-heading"
          aria-busy={catalog.isPending}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="module-matrix-heading" className="m-0 text-base font-bold">
                {t('Module and activity compatibility matrix')}
              </h2>
              <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
                {t(
                  'Code support is immutable here; catalog association is the activity’s saved module list.',
                )}
              </p>
            </div>
            {catalog.data && (
              <span
                className="rounded-full bg-waffarly-kpi-mint px-3 py-1.5 text-xs font-bold text-waffarly-primary"
                aria-live="polite"
              >
                {t('Showing {{visible}} of {{total}} modules', {
                  visible: formatCount(modules.length),
                  total: formatCount(allModules.length),
                })}
              </span>
            )}
          </div>

          {catalog.isPending ? (
            <div className="grid gap-3" role="status" aria-label={t('Loading modules matrix…')}>
              {[0, 1].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-xl bg-waffarly-input" />
              ))}
            </div>
          ) : catalog.isError && !catalog.data ? (
            <div className="grid min-h-40 place-content-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-8 text-center">
              <p className="m-0 text-sm text-waffarly-muted">
                {t('Modules matrix data is unavailable.')}
              </p>
            </div>
          ) : !allModules.length || !allActivities.length ? (
            <div className="grid min-h-48 place-content-center justify-items-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-8 text-center">
              <span
                className="grid size-11 place-items-center rounded-2xl bg-waffarly-kpi-gold text-waffarly-gold"
                aria-hidden="true"
              >
                <Network size={21} />
              </span>
              <h3 className="mb-0 mt-3 text-sm font-bold text-waffarly-ink">
                {t('No module compatibility data')}
              </h3>
              <p className="mb-0 mt-1 max-w-sm text-xs leading-5 text-waffarly-muted">
                {t('The catalog needs both modules and business activities to build this matrix.')}
              </p>
            </div>
          ) : !modules.length ? (
            <div className="grid min-h-40 place-content-center justify-items-center rounded-2xl border border-dashed border-waffarly-border bg-white px-6 py-8 text-center">
              <h3 className="m-0 text-sm font-bold text-waffarly-ink">
                {t('No modules match these filters')}
              </h3>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">
                {t('Try a different activity, relationship, or search phrase.')}
              </p>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-waffarly-primary"
                  onClick={clearFilters}
                >
                  {t('Clear filters')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <ModuleCompatibilityMatrix activities={allActivities} modules={modules} />
              <div
                className="grid gap-x-4 gap-y-2 rounded-xl border border-waffarly-border bg-white px-3 py-3 sm:grid-cols-2"
                aria-label={t('Matrix legend')}
              >
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-waffarly-ink">
                  <span className="size-2 rounded-full bg-waffarly-success" aria-hidden="true" />
                  {t('Associated in catalog')}
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-waffarly-ink">
                  <span className="size-2 rounded-full bg-waffarly-info" aria-hidden="true" />
                  {t('Supported by code, not associated')}
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-waffarly-ink">
                  <span className="size-2 rounded-full bg-waffarly-muted" aria-hidden="true" />
                  {t('Not supported')}
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-waffarly-danger">
                  <span className="size-2 rounded-full bg-waffarly-danger" aria-hidden="true" />
                  {t('Catalog mismatch')}
                </span>
              </div>
            </>
          )}
        </Card>

        <Card
          className="admin-panel grid content-start admin-stack rounded-2xl border-waffarly-border bg-white text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]"
          aria-labelledby="module-definition-heading"
        >
          <div>
            <span
              className="mb-3 grid size-9 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-info"
              aria-hidden="true"
            >
              <CircleHelp size={18} />
            </span>
            <h2 id="module-definition-heading" className="m-0 text-base font-bold">
              {t('Module boundaries')}
            </h2>
            <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
              {t('What this catalog does—and does not—define.')}
            </p>
          </div>

          <dl className="m-0 grid divide-y divide-waffarly-border">
            <div className="py-3 first:pt-0">
              <dt className="text-xs font-bold text-waffarly-ink">{t('Module support')}</dt>
              <dd className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
                {t('Each module lists the business activities supported by platform code.')}
              </dd>
            </div>
            <div className="py-3">
              <dt className="text-xs font-bold text-waffarly-ink">{t('Catalog association')}</dt>
              <dd className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
                {t('Each activity stores its own list of linked module keys.')}
              </dd>
            </div>
            <div className="py-3 last:pb-0">
              <dt className="text-xs font-bold text-waffarly-ink">{t('Not access control')}</dt>
              <dd className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
                {t(
                  'Neither relationship grants a plan entitlement, subscription, merchant access, or user permission.',
                )}
              </dd>
            </div>
          </dl>

          <div className="rounded-xl border border-waffarly-success/15 bg-waffarly-kpi-mint/60 p-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                size={16}
                className="mt-0.5 shrink-0 text-waffarly-success"
                aria-hidden="true"
              />
              <p className="m-0 text-[11px] leading-5 text-waffarly-ink">
                {t(
                  'Platform modules are defined in code; a new module needs an approved code and database change.',
                )}
              </p>
            </div>
          </div>

          <Link
            to="/activities"
            className="inline-flex w-fit items-center gap-2 text-xs font-bold text-waffarly-primary underline-offset-4 hover:underline"
          >
            <Check size={14} aria-hidden="true" />
            {t('Review business activities')}
          </Link>
        </Card>
      </div>
    </div>
  );
}
