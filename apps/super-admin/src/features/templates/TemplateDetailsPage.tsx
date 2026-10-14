import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import type { CreateStorefrontTemplateRequest, StorefrontTemplateSummary, UpdateStorefrontTemplateRequest } from '@waffarly/contracts';
import { Badge, Button, Card, useLocale, type LocalizedMessage } from '@waffarly/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { ApiError } from '../../lib/api-client.js';
import { TemplateArtwork } from './TemplateArtwork.js';
import { TemplateEditorPanel } from './TemplateEditorPanel.js';
import { TemplateEligibilityPanel } from './TemplateEligibilityPanel.js';
import { TemplateMetadataPanel } from './TemplateMetadataPanel.js';
import { useStorefrontTemplatesQuery, useUpdateStorefrontTemplateMutation } from './template-queries.js';

export function TemplateDetailsPage() {
  const { templateId = '' } = useParams();
  const { t, errorText, locale } = useLocale();
  const templatesQuery = useStorefrontTemplatesQuery();
  const updateTemplate = useUpdateStorefrontTemplateMutation();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const [actionError, setActionError] = useState('');
  const template = templatesQuery.data?.find((item) => item.id === templateId);
  const IconBack = locale === 'ar' ? ArrowRight : ArrowLeft;

  function templateUpdateBody(templateValue: StorefrontTemplateSummary, draft: CreateStorefrontTemplateRequest): UpdateStorefrontTemplateRequest {
    return {
      name: draft.name,
      description: draft.description,
      activity: draft.activity,
      layout: draft.layout,
      accentColor: draft.accentColor,
      status: draft.status,
      revision: templateValue.revision,
    };
  }

  async function saveTemplate(draft: CreateStorefrontTemplateRequest) {
    if (!template) return;
    setActionError('');
    const saved = await updateTemplate.mutateAsync({ id: template.id, body: templateUpdateBody(template, draft) });
    setNotice({ key: '{{name}} updated.', values: { name: saved.name } });
    setEditing(false);
  }

  async function toggleAvailability() {
    if (!template) return;
    setNotice('');
    setActionError('');
    try {
      const draft: CreateStorefrontTemplateRequest = {
        key: template.key,
        name: template.name,
        description: template.description,
        activity: template.activity,
        layout: template.layout,
        accentColor: template.accentColor,
        status: template.status === 'available' ? 'draft' : 'available',
      };
      const saved = await updateTemplate.mutateAsync({ id: template.id, body: templateUpdateBody(template, draft) });
      setNotice({ key: saved.status === 'available' ? '{{name}} is now available in the library.' : '{{name}} moved to drafts.', values: { name: saved.name } });
    } catch (cause) {
      setActionError(cause instanceof ApiError && cause.statusCode === 409
        ? 'This template changed in another session. Reload the library before editing.'
        : cause instanceof Error ? cause.message : 'Could not save this template.');
    }
  }

  const isMissing = Boolean(templatesQuery.data && !template);
  const loadFailed = templatesQuery.isError && !templatesQuery.data;
  const showPageLoading = templatesQuery.isPending && !templatesQuery.data;
  const updateError = updateTemplate.error;
  const error = actionError || (updateError instanceof ApiError && updateError.statusCode === 409
    ? 'This template changed in another session. Reload the library before editing.'
    : updateError?.message ?? 'Could not save this template.');
  const title = template?.name ?? t('Template details');
  const description = template?.description || t('Review the saved preview, merchant scope, and availability settings.');

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        eyebrow={t('Design library')}
        title={title}
        description={description}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" asChild className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink">
              <Link to="/templates"><IconBack size={15} aria-hidden="true" />{t('Back to library')}</Link>
            </Button>
            {template && (
              <Button type="button" variant="outline" onClick={() => { setEditing((value) => !value); setActionError(''); setNotice(''); }} className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink">
                <Eye size={15} aria-hidden="true" />{t(editing ? 'Close editor' : 'Edit design')}
              </Button>
            )}
          </div>
        )}
      />

      {notice && <p className="m-0 rounded-xl border border-waffarly-success/15 bg-waffarly-kpi-mint px-4 py-3 text-sm font-semibold text-waffarly-primary" role="status">{t(notice)}</p>}

      {(loadFailed || updateTemplate.isError || actionError) && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          <div className="min-w-0">
            <strong className="block">{t(loadFailed ? 'Could not load templates.' : actionError ? 'Could not update template availability.' : 'Could not save this template.')}</strong>
            <p className="mb-0 mt-1 text-xs">{errorText(loadFailed ? (templatesQuery.error instanceof Error ? templatesQuery.error.message : 'Something went wrong.') : error)}</p>
          </div>
          <Button variant="outline" size="sm" className="border-waffarly-danger/20 bg-white text-waffarly-danger hover:bg-waffarly-danger-bg hover:text-waffarly-danger" onClick={() => {
            setActionError('');
            updateTemplate.reset();
            void templatesQuery.refetch();
          }}>{t('Try again')}</Button>
        </div>
      )}

      {showPageLoading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]" role="status" aria-label={t('Loading template details…')}>
          <div className="h-72 animate-pulse rounded-2xl border border-waffarly-border bg-waffarly-input" />
          <div className="h-72 animate-pulse rounded-2xl border border-waffarly-border bg-waffarly-input" />
        </div>
      ) : loadFailed ? (
        <Card className="grid min-h-48 place-content-center justify-items-center gap-3 rounded-2xl border-waffarly-border bg-white p-6 text-center text-waffarly-ink">
          <span className="grid size-11 place-items-center rounded-2xl bg-waffarly-kpi-gold text-waffarly-gold" aria-hidden="true"><RefreshCw size={20} /></span>
          <div><h2 className="m-0 text-sm font-bold">{t('Template library unavailable.')}</h2><p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('Try again to load this template.')}</p></div>
          <Button type="button" onClick={() => void templatesQuery.refetch()} className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover">{t('Try again')}</Button>
        </Card>
      ) : isMissing ? (
        <Card className="grid min-h-48 place-content-center justify-items-center gap-3 rounded-2xl border-waffarly-border bg-white p-6 text-center text-waffarly-ink">
          <span className="grid size-11 place-items-center rounded-2xl bg-waffarly-kpi-blue text-waffarly-info" aria-hidden="true"><ShieldCheck size={20} /></span>
          <div><h2 className="m-0 text-sm font-bold">{t('This template is no longer in the library.')}</h2><p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('Return to the design library to review the current templates.')}</p></div>
          <Button type="button" variant="outline" asChild className="border-waffarly-border bg-white text-waffarly-ink"><Link to="/templates">{t('Back to library')}</Link></Button>
        </Card>
      ) : template ? (
        <>
          {editing && <TemplateEditorPanel key={`${template.id}-${template.revision}`} template={template} busy={updateTemplate.isPending} onCancel={() => setEditing(false)} onSubmit={saveTemplate} onReload={() => { setEditing(false); updateTemplate.reset(); void templatesQuery.refetch(); }} />}

          <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]" aria-label={t('Template overview')}>
            <Card className="min-w-0 overflow-hidden rounded-2xl border-waffarly-border bg-white p-0 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
              <div className="relative overflow-hidden bg-waffarly-input">
                <TemplateArtwork template={template} />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-3">
                  <Badge variant={template.status === 'available' ? 'success' : 'warning'} className="border border-white/70 bg-white/90 shadow-sm">
                    <span className={`size-1.5 rounded-full ${template.status === 'available' ? 'bg-waffarly-success' : 'bg-waffarly-gold'}`} aria-hidden="true" />
                    {t(template.status === 'available' ? 'Available' : 'Draft')}
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-waffarly-ink shadow-sm"><Check size={12} aria-hidden="true" />{t(template.layout === 'menu' ? 'Catalog first' : 'Welcome first')}</span>
                </div>
              </div>
              <div className="grid gap-2 p-4 md:p-5">
                <code className="w-fit rounded-lg bg-waffarly-input px-2 py-1 text-[10px] text-waffarly-muted" dir="ltr">/{template.key}</code>
                <h2 className="m-0 text-lg font-bold text-waffarly-ink">{template.name}</h2>
                <p className="mb-0 text-sm leading-6 text-waffarly-muted">{template.description || t('A business storefront design.')}</p>
              </div>
            </Card>

            <TemplateMetadataPanel template={template} />
          </section>

          <section className="grid min-w-0 gap-4 xl:grid-cols-2" aria-label={t('Template eligibility and availability')}>
            <TemplateEligibilityPanel template={template} />
            <Card className="grid content-start gap-4 rounded-2xl border-waffarly-border bg-white p-4 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)] md:p-5" aria-labelledby="template-availability-heading">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary" aria-hidden="true"><ShieldCheck size={17} /></span>
                <div>
                  <h2 id="template-availability-heading" className="m-0 text-base font-bold">{t('Availability')}</h2>
                  <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Availability controls new storefront selections; it does not publish a storefront.')}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-waffarly-border bg-waffarly-input/45 p-3">
                <div>
                  <p className="m-0 text-[10px] font-semibold text-waffarly-muted">{t('Current status')}</p>
                  <p className="mb-0 mt-1 text-sm font-bold text-waffarly-ink">{t(template.status === 'available' ? 'Available' : 'Draft')}</p>
                </div>
                <Button type="button" disabled={updateTemplate.isPending} variant={template.status === 'available' ? 'outline' : 'default'} onClick={() => void toggleAvailability()} className={template.status === 'available' ? 'border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input hover:text-waffarly-ink' : 'bg-waffarly-primary text-white hover:bg-waffarly-primary-hover'}>
                  {updateTemplate.isPending ? t('Saving…') : template.status === 'available' ? t('Move to drafts') : t('Make available')}
                </Button>
              </div>
              <div className="rounded-xl border border-waffarly-info/15 bg-waffarly-kpi-blue/45 p-3">
                <p className="m-0 text-[11px] leading-5 text-waffarly-ink">{t('Changing availability updates the library only. A merchant storefront changes only when that merchant saves its own storefront settings.')}</p>
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
