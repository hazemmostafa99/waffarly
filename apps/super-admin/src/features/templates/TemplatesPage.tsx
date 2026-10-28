import { useMemo, useState } from 'react';
import { LayoutTemplate, Palette, Plus, RefreshCw, Search, Sparkles } from 'lucide-react';
import type { CreateStorefrontTemplateRequest, StorefrontTemplateSummary, TemplateStatus, UpdateStorefrontTemplateRequest } from '@waffarly/contracts';
import { BUSINESS_ACTIVITY_KEYS, BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';
import { Button, Card, Input, useLocale, type LocalizedMessage } from '@waffarly/ui';
import { useSearchParams } from 'react-router-dom';
import { CompactStatCard } from '../../components/CompactStatCard.js';
import { PageHeader } from '../../components/PageHeader.js';
import { ApiError } from '../../lib/api-client.js';
import { TemplateCard } from './TemplateCard.js';
import { TemplateEditorPanel } from './TemplateEditorPanel.js';
import { useCreateStorefrontTemplateMutation, useStorefrontTemplatesQuery, useUpdateStorefrontTemplateMutation } from './template-queries.js';

type StatusFilter = 'all' | TemplateStatus;
const statusFilters: StatusFilter[] = ['all', 'available', 'draft'];

function activityName(activity: StorefrontTemplateSummary['activity']) {
  return activity === 'general' ? 'All business activities' : BUSINESS_ACTIVITY_LABELS[activity];
}

export function TemplatesPage() {
  const { t, errorText, locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const templatesQuery = useStorefrontTemplatesQuery();
  const createTemplate = useCreateStorefrontTemplateMutation();
  const updateTemplate = useUpdateStorefrontTemplateMutation();
  const [editing, setEditing] = useState<StorefrontTemplateSummary | null | undefined>(undefined);
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const [actionError, setActionError] = useState('');

  const templates = templatesQuery.data ?? [];
  const query = searchParams.get('q') ?? '';
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const rawStatus = searchParams.get('status') as StatusFilter | null;
  const statusFilter = rawStatus && statusFilters.includes(rawStatus) ? rawStatus : 'all';
  const rawActivity = searchParams.get('activity') ?? 'all';
  const activityFilter = rawActivity === 'all' || rawActivity === 'general' || BUSINESS_ACTIVITY_KEYS.includes(rawActivity as typeof BUSINESS_ACTIVITY_KEYS[number])
    ? rawActivity
    : 'all';
  const formatCount = (value: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB-u-nu-latn').format(value);
  const busy = createTemplate.isPending || updateTemplate.isPending;

  function updateFilter(key: 'q' | 'status' | 'activity', value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }

  const visibleTemplates = useMemo(() => templates.filter((template) => {
    if (statusFilter !== 'all' && template.status !== statusFilter) return false;
    if (activityFilter !== 'all' && template.activity !== activityFilter) return false;
    if (!normalizedQuery) return true;
    return [template.name, template.key, template.description, template.activity, t(activityName(template.activity))]
      .join(' ').toLocaleLowerCase(locale).includes(normalizedQuery);
  }), [activityFilter, locale, normalizedQuery, statusFilter, t, templates]);

  const hasFilters = Boolean(query.trim()) || statusFilter !== 'all' || activityFilter !== 'all';
  const mutationError = createTemplate.error ?? updateTemplate.error;
  const errorMessage = actionError || (mutationError instanceof ApiError && mutationError.statusCode === 409
    ? 'This template changed in another session. Reload the library before editing.'
    : mutationError?.message ?? 'Could not save this template.');

  function openCreate() {
    setNotice('');
    setActionError('');
    createTemplate.reset();
    updateTemplate.reset();
    setEditing(null);
  }

  function openEdit(template: StorefrontTemplateSummary) {
    setNotice('');
    setActionError('');
    setEditing(template);
  }

  async function saveTemplate(draft: CreateStorefrontTemplateRequest) {
    setActionError('');
    if (editing) {
      const body: UpdateStorefrontTemplateRequest = {
        name: draft.name,
        description: draft.description,
        activity: draft.activity,
        layout: draft.layout,
        accentColor: draft.accentColor,
        status: draft.status,
        revision: editing.revision,
      };
      const saved = await updateTemplate.mutateAsync({ id: editing.id, body });
      setNotice({ key: '{{name}} updated.', values: { name: saved.name } });
    } else {
      const saved = await createTemplate.mutateAsync(draft);
      setNotice({ key: '{{name}} added to the library.', values: { name: saved.name } });
    }
    setEditing(undefined);
  }

  async function toggleAvailability(template: StorefrontTemplateSummary) {
    setActionError('');
    setNotice('');
    try {
      const nextStatus = template.status === 'available' ? 'draft' : 'available';
      const body: UpdateStorefrontTemplateRequest = {
        name: template.name,
        description: template.description,
        activity: template.activity,
        layout: template.layout,
        accentColor: template.accentColor,
        status: nextStatus,
        revision: template.revision,
      };
      const saved = await updateTemplate.mutateAsync({ id: template.id, body });
      setNotice({ key: saved.status === 'available' ? '{{name}} is now available in the library.' : '{{name}} moved to drafts.', values: { name: saved.name } });
    } catch (cause) {
      setActionError(cause instanceof ApiError && cause.statusCode === 409
        ? 'This template changed in another session. Reload the library before editing.'
        : cause instanceof Error ? cause.message : 'Could not save this template.');
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={t('The design library')}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={openCreate} className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover">
              <Plus size={15} aria-hidden="true" />{t('Add a template')}
            </Button>
            <Button type="button" variant="outline" disabled={templatesQuery.isFetching} onClick={() => void templatesQuery.refetch()} className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink">
              <RefreshCw size={15} aria-hidden="true" className={templatesQuery.isFetching ? 'animate-spin' : ''} />{t('Refresh library')}
            </Button>
          </div>
        )}
      />

      <section className="admin-stats-grid grid gap-3 sm:grid-cols-3" aria-label={t('Design library summary')}>
        <CompactStatCard label={t('All designs')} value={templatesQuery.data ? formatCount(templates.length) : '—'} helper={t('Storefront designs currently in the library.')} icon={LayoutTemplate} tone="mint" loading={templatesQuery.isPending} />
        <CompactStatCard label={t('Available')} value={templatesQuery.data ? formatCount(templates.filter((template) => template.status === 'available').length) : '—'} helper={t('Ready for future merchant selection.')} icon={Sparkles} tone="blue" loading={templatesQuery.isPending} />
        <CompactStatCard label={t('Drafts')} value={templatesQuery.data ? formatCount(templates.filter((template) => template.status === 'draft').length) : '—'} helper={t('Visible to platform administrators only.')} icon={Palette} tone="gold" loading={templatesQuery.isPending} />
      </section>

      {notice && <p className="m-0 rounded-xl border border-waffarly-success/15 bg-waffarly-kpi-mint px-4 py-3 text-sm font-semibold text-waffarly-primary" role="status">{t(notice)}</p>}

      {(templatesQuery.isError || mutationError || actionError) && (
        <div className="flex flex-wrap items-center justify-between admin-stack rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          <div className="min-w-0">
            <strong className="block">{t(templatesQuery.isError ? 'Could not load templates.' : 'Could not save this template.')}</strong>
            <p className="mb-0 mt-1 text-xs">{errorText(templatesQuery.isError ? (templatesQuery.error instanceof Error ? templatesQuery.error.message : 'Something went wrong.') : errorMessage)}</p>
          </div>
          <Button variant="outline" size="sm" className="border-waffarly-danger/20 bg-white text-waffarly-danger hover:bg-waffarly-danger-bg hover:text-waffarly-danger" onClick={() => {
            setActionError('');
            createTemplate.reset();
            updateTemplate.reset();
            void templatesQuery.refetch();
          }}>{t('Try again')}</Button>
        </div>
      )}

      {editing !== undefined && (
        <TemplateEditorPanel
          key={editing?.id ?? 'new-template'}
          template={editing}
          busy={busy}
          onCancel={() => setEditing(undefined)}
          onSubmit={saveTemplate}
          onReload={() => {
            setEditing(undefined);
            void templatesQuery.refetch();
          }}
        />
      )}

      <Card className="admin-panel grid min-w-0 admin-stack rounded-2xl border-waffarly-border bg-white text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]" aria-labelledby="templates-heading" aria-busy={templatesQuery.isPending}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="templates-heading" className="m-0 text-base font-bold">{t('Storefront templates')}</h2>
            <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Search and filter the saved design library.')}</p>
          </div>
          {templatesQuery.data && <span className="rounded-full bg-waffarly-kpi-mint px-3 py-1.5 text-xs font-bold text-waffarly-primary" aria-live="polite">{t('Showing {{visible}} of {{total}}', { visible: formatCount(visibleTemplates.length), total: formatCount(templates.length) })}</span>}
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_210px_auto]">
          <label className="relative block min-w-0">
            <span className="sr-only">{t('Search templates')}</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-waffarly-muted" size={16} aria-hidden="true" />
            <Input type="search" className="h-10 rounded-xl border-waffarly-border bg-waffarly-input/50 ps-10 pe-3 text-sm text-waffarly-ink placeholder:text-waffarly-muted focus-visible:bg-white" placeholder={t('Search by name, key, description, or activity')} value={query} onChange={(event) => updateFilter('q', event.target.value)} />
          </label>
          <label className="relative block">
            <span className="sr-only">{t('Filter by activity')}</span>
            <select aria-label={t('Filter by activity')} className="h-10 w-full rounded-xl border border-waffarly-border bg-white px-3 text-sm text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary/20" value={activityFilter} onChange={(event) => updateFilter('activity', event.target.value)}>
              <option value="all">{t('All business activities')}</option>
              <option value="general">{t('General designs')}</option>
              {BUSINESS_ACTIVITY_KEYS.map((activity) => <option key={activity} value={activity}>{t(BUSINESS_ACTIVITY_LABELS[activity])}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-1 rounded-xl border border-waffarly-border bg-waffarly-input/60 p-1" role="group" aria-label={t('Filter templates')}>
            {statusFilters.map((status) => (
              <button key={status} type="button" aria-pressed={statusFilter === status} onClick={() => updateFilter('status', status)} className={`min-h-8 flex-1 rounded-lg px-3 text-xs font-semibold transition-colors ${statusFilter === status ? 'bg-white text-waffarly-primary shadow-sm' : 'text-waffarly-muted hover:bg-white/70 hover:text-waffarly-ink'}`}>
                {t(status === 'all' ? 'All' : status === 'available' ? 'Available' : 'Drafts')}
                {templatesQuery.data && <span className="ms-1.5 text-[10px] opacity-70">{formatCount(status === 'all' ? templates.length : templates.filter((template) => template.status === status).length)}</span>}
              </button>
            ))}
          </div>
        </div>

        {templatesQuery.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t('Loading your design library…')}>
            {[0, 1, 2].map((item) => <div key={item} className="overflow-hidden rounded-2xl border border-waffarly-border bg-white"><div className="aspect-[16/9] animate-pulse bg-waffarly-input" /><div className="admin-section grid gap-2"><div className="h-3 w-2/5 animate-pulse rounded bg-waffarly-input" /><div className="h-4 w-3/5 animate-pulse rounded bg-waffarly-input" /><div className="h-3 w-full animate-pulse rounded bg-waffarly-input" /></div></div>)}
          </div>
        ) : templatesQuery.isError && !templatesQuery.data ? (
          <div className="grid min-h-40 place-content-center rounded-2xl border border-dashed border-waffarly-border bg-waffarly-input/50 px-6 py-8 text-center">
            <p className="m-0 text-sm text-waffarly-muted">{t('Template library unavailable.')}</p>
          </div>
        ) : !templates.length ? (
          <div className="grid min-h-48 place-content-center justify-items-center rounded-2xl border border-dashed border-waffarly-border bg-waffarly-input/50 px-6 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-waffarly-kpi-gold text-waffarly-gold" aria-hidden="true"><LayoutTemplate size={21} /></span>
            <h3 className="mb-0 mt-3 text-sm font-bold text-waffarly-ink">{t('Your library starts here')}</h3>
            <p className="mb-0 mt-1 max-w-sm text-xs leading-5 text-waffarly-muted">{t('Add a business design to start curating what merchants can discover.')}</p>
            <Button type="button" className="mt-4 bg-waffarly-primary text-white hover:bg-waffarly-primary-hover" onClick={openCreate}><Plus size={15} aria-hidden="true" />{t('Create the first template')}</Button>
          </div>
        ) : !visibleTemplates.length ? (
          <div className="grid min-h-40 place-content-center justify-items-center rounded-2xl border border-dashed border-waffarly-border bg-waffarly-input/50 px-6 py-8 text-center">
            <h3 className="m-0 text-sm font-bold text-waffarly-ink">{t('No designs match that search')}</h3>
            <p className="mb-0 mt-1 max-w-sm text-xs leading-5 text-waffarly-muted">{t('Try another name or status.')}</p>
            {hasFilters && <Button variant="ghost" size="sm" className="mt-2 text-waffarly-primary" onClick={() => setSearchParams({}, { replace: true })}>{t('Clear filters')}</Button>}
          </div>
        ) : (
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTemplates.map((template) => <TemplateCard key={template.id} template={template} busy={updateTemplate.isPending} onEdit={openEdit} onToggleAvailability={(value) => void toggleAvailability(value)} />)}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-start gap-2 rounded-xl border border-waffarly-info/15 bg-waffarly-kpi-blue/45 px-4 py-3 text-xs leading-5 text-waffarly-muted">
        <span className="mt-0.5 text-waffarly-info" aria-hidden="true"><Sparkles size={15} /></span>
        <p className="m-0 flex-1">{t('Availability adds the design to the merchant library; it does not publish a storefront.')}</p>
      </div>
    </div>
  );
}
