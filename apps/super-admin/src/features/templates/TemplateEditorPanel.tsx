import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Eye, Pencil, Plus, ShieldCheck, X } from 'lucide-react';
import { BUSINESS_ACTIVITY_KEYS, BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';
import type {
  BusinessActivityKey,
  CreateStorefrontTemplateRequest,
  StorefrontTemplateSummary,
  TemplateLayout,
  TemplateStatus,
} from '@waffarly/contracts';
import { Button, Card, Input, Textarea, useLocale } from '@waffarly/ui';
import { ApiError } from '../../lib/api-client.js';
import { TemplateFormArtwork } from './TemplateArtwork.js';
import { emptyTemplateDraft } from './template-defaults.js';

interface TemplateEditorPanelProps {
  template: StorefrontTemplateSummary | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (draft: CreateStorefrontTemplateRequest) => Promise<void>;
  onReload: () => void;
}

function activityName(activity: BusinessActivityKey) {
  return BUSINESS_ACTIVITY_LABELS[activity];
}

export function TemplateEditorPanel({
  template,
  busy,
  onCancel,
  onSubmit,
  onReload,
}: TemplateEditorPanelProps) {
  const { t, errorText } = useLocale();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState<CreateStorefrontTemplateRequest>(() =>
    template
      ? {
          key: template.key,
          name: template.name,
          description: template.description,
          activity: template.activity,
          layout: template.layout,
          accentColor: template.accentColor,
          status: template.status,
        }
      : { ...emptyTemplateDraft },
  );
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);

  useEffect(() => headingRef.current?.focus(), []);

  function update<K extends keyof CreateStorefrontTemplateRequest>(
    key: K,
    value: CreateStorefrontTemplateRequest[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveError('');
    setConflict(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict) return;
    setSaveError('');
    try {
      await onSubmit({
        ...draft,
        key: draft.key.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 409) {
        setConflict(true);
        return;
      }
      setSaveError(cause instanceof Error ? cause.message : 'Could not save this template.');
    }
  }

  const fieldClass = 'grid gap-1.5 text-xs font-semibold text-waffarly-ink';
  const inputClass = 'h-10 rounded-xl border-waffarly-border bg-white text-sm text-waffarly-ink';
  const isEditing = template !== null;

  return (
    <Card
      className="admin-panel grid min-w-0 admin-stack rounded-2xl border-waffarly-border bg-white text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]"
      aria-busy={busy}
    >
      <div className="flex items-start justify-between admin-stack">
        <div>
          <span
            className="mb-3 grid size-9 place-items-center rounded-xl bg-waffarly-kpi-gold text-waffarly-gold"
            aria-hidden="true"
          >
            {isEditing ? <Pencil size={17} /> : <Plus size={18} />}
          </span>
          <h2 ref={headingRef} tabIndex={-1} className="m-0 text-base font-bold">
            {t(isEditing ? 'Edit template' : 'Create template')}
          </h2>
          <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
            {t('Set the storefront presentation and its library availability.')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-waffarly-muted hover:bg-waffarly-input hover:text-waffarly-ink"
          aria-label={t('Close editor')}
          onClick={onCancel}
          disabled={busy}
        >
          <X size={17} aria-hidden="true" />
        </Button>
      </div>

      {saveError && (
        <p
          className="m-0 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-3 py-2 text-xs leading-5 text-waffarly-danger"
          role="alert"
        >
          {errorText(saveError)}
        </p>
      )}
      {conflict && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-waffarly-gold/25 bg-waffarly-kpi-gold/50 p-3"
          role="alert"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle
              size={15}
              className="mt-0.5 shrink-0 text-waffarly-gold"
              aria-hidden="true"
            />
            <p className="m-0 text-xs leading-5 text-waffarly-ink">
              {t('This template changed in another session. Reload the library before editing.')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-waffarly-border bg-white text-waffarly-ink"
            onClick={onReload}
          >
            {t('Reload library')}
          </Button>
        </div>
      )}

      <form
        className="grid min-w-0 admin-stack xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"
        onSubmit={(event) => void submit(event)}
      >
        <fieldset
          className="m-0 grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-2"
          disabled={busy || conflict}
        >
          <label className={`${fieldClass} sm:col-span-2`}>
            <span>{t('Display name')}</span>
            <Input
              autoFocus
              maxLength={160}
              required
              value={draft.name}
              placeholder={t('Sunday Table')}
              className={inputClass}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>

          <label className={fieldClass}>
            <span>{t('Library key')}</span>
            <span className="text-[10px] font-normal text-waffarly-muted">
              {t('Permanent identifier for this design')}
            </span>
            <Input
              disabled={isEditing}
              maxLength={80}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={draft.key}
              placeholder="sunday-table"
              className={`${inputClass} font-mono`}
              dir="ltr"
              onChange={(event) =>
                update('key', event.target.value.toLowerCase().replace(/\s+/g, '-'))
              }
            />
          </label>

          <label className={fieldClass}>
            <span>{t('Business activity')}</span>
            <span className="relative block">
              <select
                value={draft.activity}
                className="h-10 w-full appearance-none rounded-xl border border-waffarly-border bg-white px-3 text-sm text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary/20"
                onChange={(event) =>
                  update(
                    'activity',
                    event.target.value as CreateStorefrontTemplateRequest['activity'],
                  )
                }
              >
                <option value="general">{t('All business activities')}</option>
                {BUSINESS_ACTIVITY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(activityName(key))}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className={`${fieldClass} sm:col-span-2`}>
            <span>{t('Description')}</span>
            <Textarea
              rows={3}
              maxLength={1000}
              value={draft.description}
              placeholder={t('A clear layout that puts your catalog first.')}
              className="min-h-20 rounded-xl border-waffarly-border bg-white text-sm leading-5 text-waffarly-ink"
              onChange={(event) => update('description', event.target.value)}
            />
          </label>

          <label className={fieldClass}>
            <span>{t('Business layout')}</span>
            <select
              value={draft.layout}
              className="h-10 w-full rounded-xl border border-waffarly-border bg-white px-3 text-sm text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary/20"
              onChange={(event) => update('layout', event.target.value as TemplateLayout)}
            >
              <option value="menu">{t('Catalog first · editorial grid')}</option>
              <option value="hero">{t('Welcome first · featured catalog')}</option>
            </select>
          </label>

          <label className={fieldClass}>
            <span>{t('Library status')}</span>
            <select
              value={draft.status}
              className="h-10 w-full rounded-xl border border-waffarly-border bg-white px-3 text-sm text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary/20"
              onChange={(event) => update('status', event.target.value as TemplateStatus)}
            >
              <option value="draft">{t('Draft · only admins can see it')}</option>
              <option value="available">
                {t('Available · ready for future merchant selection')}
              </option>
            </select>
          </label>

          <label className={`${fieldClass} sm:col-span-2`}>
            <span>{t('Accent color')}</span>
            <span className="flex h-10 items-center gap-3 rounded-xl border border-waffarly-border bg-white px-2.5">
              <Input
                type="color"
                aria-label={t('Accent color')}
                value={draft.accentColor}
                className="size-7 cursor-pointer rounded-lg border-0 p-0"
                onChange={(event) => update('accentColor', event.target.value)}
              />
              <span
                className="font-mono text-xs font-medium tracking-wide text-waffarly-muted"
                dir="ltr"
              >
                {draft.accentColor.toUpperCase()}
              </span>
            </span>
          </label>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="submit"
              disabled={busy || conflict}
              className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover"
            >
              {busy ? t('Saving…') : isEditing ? t('Save changes') : t('Create template')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-waffarly-border bg-white text-waffarly-ink"
              onClick={onCancel}
              disabled={busy}
            >
              {t('Cancel')}
            </Button>
          </div>
        </fieldset>

        <div className="grid content-start gap-3">
          <div className="overflow-hidden rounded-2xl border border-waffarly-border bg-waffarly-input">
            <TemplateFormArtwork
              layout={draft.layout}
              name={draft.name || t('Your business')}
              description={draft.description}
            />
            <div className="flex items-center justify-between gap-3 bg-white px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-waffarly-ink">
                <Eye size={14} aria-hidden="true" />
                {t('Storefront preview')}
              </span>
              <span
                className="size-3 rounded-full ring-2 ring-white"
                style={{ backgroundColor: draft.accentColor }}
                aria-label={t('Accent color')}
              />
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-waffarly-success/15 bg-waffarly-kpi-mint/55 p-3">
            <ShieldCheck
              size={15}
              className="mt-0.5 shrink-0 text-waffarly-success"
              aria-hidden="true"
            />
            <p className="m-0 text-[11px] leading-5 text-waffarly-ink">
              {t(
                'Availability adds the design to the merchant library; it does not publish a storefront.',
              )}
            </p>
          </div>
        </div>
      </form>
    </Card>
  );
}
