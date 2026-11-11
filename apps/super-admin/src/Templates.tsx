import { BUSINESS_ACTIVITY_KEYS, BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';
import type { LocalizedMessage } from '@waffarly/ui';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CreateStorefrontTemplateRequest,
  StorefrontTemplateSummary,
  TemplateLayout,
  TemplateStatus,
  UpdateStorefrontTemplateRequest,
} from '@waffarly/contracts';
import { StorefrontDesignPreview, useLocale, Button, Input, Textarea } from '@waffarly/ui';
import { ApiError, apiRequest } from './lib/api-client.js';

const emptyTemplate: CreateStorefrontTemplateRequest = {
  key: '',
  name: '',
  description: '',
  activity: 'restaurant',
  layout: 'menu',
  accentColor: '#315b43',
  status: 'draft',
};

function explainError(cause: unknown): string {
  return cause instanceof ApiError && cause.statusCode === 409
    ? 'This template changed in another session. Reload the library before editing.'
    : cause instanceof Error
      ? cause.message
      : 'Could not save this template.';
}

function StorefrontPreview({
  layout,
  name,
  description,
  accentColor,
}: {
  layout: TemplateLayout;
  name: string;
  description: string;
  accentColor: string;
}) {
  const { t } = useLocale();
  return (
    <StorefrontDesignPreview
      className="storefront-preview"
      layout={layout}
      name={name || t('Your business')}
      description={description}
      accentColor={accentColor}
    />
  );
}

function TemplateForm({
  initial,
  busy,
  onSubmit,
  onCancel,
  onValueChange,
}: {
  initial: CreateStorefrontTemplateRequest;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onValueChange: (value: CreateStorefrontTemplateRequest) => void;
}) {
  const { t } = useLocale();
  const [form, setForm] = useState(initial);
  const [showPreview, setShowPreview] = useState(false);

  function update<K extends keyof CreateStorefrontTemplateRequest>(
    key: K,
    value: CreateStorefrontTemplateRequest[K],
  ) {
    const next = { ...form, [key]: value };
    setForm(next);
    onValueChange(next);
  }

  return (
    <form className="template-editor" onSubmit={onSubmit}>
      <div className="template-fields">
        <div className="template-editor-heading">
          <span className="eyebrow">{initial.key ? t('EDIT TEMPLATE') : t('NEW DESIGN')}</span>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="icon-button"
            aria-label={t('Close editor')}
            onClick={onCancel}
          >
            ×
          </Button>
        </div>
        <label>
          {t('Display name')}{' '}
          <Input
            autoFocus
            maxLength={160}
            required
            value={form.name}
            placeholder={t('Sunday Table')}
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
        <label>
          {t('Library key')}
          <small>{t('Permanent identifier for this design')}</small>
          <Input
            disabled={Boolean(initial.key)}
            maxLength={80}
            required
            value={form.key}
            placeholder="sunday-table"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            onChange={(event) =>
              update('key', event.target.value.toLowerCase().replace(/\s+/g, '-'))
            }
          />
        </label>
        <label>
          {t('Description')} <small>{t('Shown to administrators in the library')}</small>
          <Textarea
            maxLength={1000}
            rows={3}
            value={form.description}
            placeholder={t('A clear layout that puts your catalog first.')}
            onChange={(event) => update('description', event.target.value)}
          />
        </label>
        <label>
          {t('Business activity')}
          <select
            aria-label={t('Business activity')}
            value={form.activity ?? 'restaurant'}
            onChange={(event) =>
              update('activity', event.target.value as CreateStorefrontTemplateRequest['activity'])
            }
          >
            <option value="general">{t('All business activities')}</option>
            {BUSINESS_ACTIVITY_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(BUSINESS_ACTIVITY_LABELS[key])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Business layout')}{' '}
          <select
            value={form.layout}
            onChange={(event) => update('layout', event.target.value as TemplateLayout)}
          >
            <option value="menu">{t('Catalog first · editorial grid')}</option>
            <option value="hero">{t('Welcome first · featured catalog')}</option>
          </select>
        </label>
        <label>
          {t('Accent color')}{' '}
          <div className="template-color-field">
            <Input
              aria-label={t('Accent color')}
              type="color"
              value={form.accentColor}
              onChange={(event) => update('accentColor', event.target.value)}
            />
            <span>{form.accentColor.toUpperCase()}</span>
          </div>
        </label>
        <label>
          {t('Library status')}{' '}
          <select
            value={form.status}
            onChange={(event) => update('status', event.target.value as TemplateStatus)}
          >
            <option value="draft">{t('Draft · only admins can see it')}</option>
            <option value="available">
              {t('Available · ready for future merchant selection')}
            </option>
          </select>
        </label>
        <p className="template-form-note">
          {t(
            'A business preview using sample content. Availability adds this design to the library; it does not publish a business storefront.',
          )}{' '}
        </p>
        <div className="template-form-actions">
          <Button type="submit" disabled={busy}>
            {busy ? t('Saving…') : initial.key ? t('Save changes') : t('Create template')}
          </Button>
          <Button
            variant="outline"
            type="button"
            className="secondary"
            onClick={() => setShowPreview((current) => !current)}
          >
            {showPreview ? t('Hide preview') : t('Preview design')}
          </Button>
        </div>
      </div>
      {showPreview && (
        <StorefrontPreview
          layout={form.layout}
          name={form.name}
          description={form.description}
          accentColor={form.accentColor}
        />
      )}
    </form>
  );
}

export function Templates() {
  const { t, errorText } = useLocale();
  const [templates, setTemplates] = useState<StorefrontTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | TemplateStatus>('all');
  const [editing, setEditing] = useState<StorefrontTemplateSummary | null | undefined>(undefined);
  const [draft, setDraft] = useState(emptyTemplate);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      setTemplates(await apiRequest<StorefrontTemplateSummary[]>('/admin/templates'));
    } catch (cause) {
      setError(explainError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          (filter === 'all' || template.status === filter) &&
          `${template.name} ${template.key}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [filter, query, templates],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
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
        const saved = await apiRequest<StorefrontTemplateSummary>(
          `/admin/templates/${editing.id}`,
          { method: 'PATCH', body: JSON.stringify(body) },
        );
        setTemplates((current) =>
          current.map((template) => (template.id === saved.id ? saved : template)),
        );
        setNotice({ key: '{{name}} updated.', values: { name: saved.name } });
      } else {
        const saved = await apiRequest<StorefrontTemplateSummary>('/admin/templates', {
          method: 'POST',
          body: JSON.stringify(draft),
        });
        setTemplates((current) => [saved, ...current]);
        setNotice({ key: '{{name}} added to the library.', values: { name: saved.name } });
      }
      setEditing(undefined);
    } catch (cause) {
      setError(explainError(cause));
    } finally {
      setSaving(false);
    }
  }

  function edit(template: StorefrontTemplateSummary) {
    setDraft({
      key: template.key,
      name: template.name,
      description: template.description,
      activity: template.activity,
      layout: template.layout,
      accentColor: template.accentColor,
      status: template.status,
    });
    setEditing(template);
    setError('');
    setNotice('');
  }

  function cancel() {
    setEditing(undefined);
    setDraft(emptyTemplate);
  }

  return (
    <section className="template-library" aria-labelledby="library-heading">
      <header className="library-heading">
        <div>
          <span className="eyebrow">{t('STOREFRONT · BUSINESSES')}</span>
          <h2 id="library-heading">{t('The design library')}</h2>
          <p>{t('Curate the business designs merchants can discover.')}</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setDraft(emptyTemplate);
            setEditing(null);
            setNotice('');
            setError('');
          }}
        >
          {t('＋ Add a template')}{' '}
        </Button>
      </header>
      {error && (
        <p className="error" role="alert">
          {errorText(error)}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
      <div className="library-toolbar">
        <div className="template-filters" aria-label={t('Filter templates')}>
          <Button
            variant="ghost"
            type="button"
            className={filter === 'all' ? 'filter-active' : ''}
            onClick={() => setFilter('all')}
          >
            {t('All')} <span>{templates.length}</span>
          </Button>
          <Button
            variant="ghost"
            type="button"
            className={filter === 'available' ? 'filter-active' : ''}
            onClick={() => setFilter('available')}
          >
            {t('Available')}{' '}
            <span>{templates.filter((template) => template.status === 'available').length}</span>
          </Button>
          <Button
            variant="ghost"
            type="button"
            className={filter === 'draft' ? 'filter-active' : ''}
            onClick={() => setFilter('draft')}
          >
            {t('Drafts')}{' '}
            <span>{templates.filter((template) => template.status === 'draft').length}</span>
          </Button>
        </div>
        <Input
          className="template-search"
          aria-label={t('Search templates')}
          placeholder={t('Search the library')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button
          variant="outline"
          type="button"
          className="secondary refresh-button"
          onClick={() => void reload()}
          disabled={loading}
        >
          {loading ? t('Loading…') : t('Refresh')}
        </Button>
      </div>
      {editing !== undefined && (
        <TemplateForm
          key={editing?.id ?? 'new-template'}
          initial={editing ? draft : emptyTemplate}
          busy={saving}
          onSubmit={(event) => void save(event)}
          onCancel={cancel}
          onValueChange={setDraft}
        />
      )}
      {loading && templates.length === 0 ? (
        <div className="library-empty">
          <p>{t('Loading your design library…')}</p>
        </div>
      ) : visibleTemplates.length === 0 ? (
        <div className="library-empty">
          <span className="empty-mark">✳</span>
          <h3>
            {query || filter !== 'all'
              ? t('No designs match that search')
              : t('Your library starts here')}
          </h3>
          <p>
            {query || filter !== 'all'
              ? t('Try another name or status.')
              : t('Add a business design to start curating what merchants can discover.')}
          </p>
          {!query && filter === 'all' && (
            <Button
              variant="outline"
              type="button"
              className="secondary"
              onClick={() => {
                setDraft(emptyTemplate);
                setEditing(null);
              }}
            >
              {t('Create the first template')}{' '}
            </Button>
          )}
        </div>
      ) : (
        <div className="template-grid">
          {visibleTemplates.map((template, index) => (
            <article className="template-card" key={template.id}>
              <Button
                variant="ghost"
                className="template-art block h-auto w-full whitespace-normal rounded-none p-0"
                type="button"
                aria-label={t('Preview {{name}}', { name: template.name })}
                onClick={() => edit(template)}
              >
                <StorefrontPreview
                  layout={template.layout}
                  name={template.name}
                  description={template.description}
                  accentColor={template.accentColor}
                />
                <span className="art-overlay">
                  {t('View & edit design')} <span aria-hidden="true">↗</span>
                </span>
              </Button>
              <div className="template-card-copy">
                <div className="template-card-meta">
                  <span className={`template-status status-${template.status}`}>
                    <span aria-hidden="true">●</span>
                    {template.status === 'available' ? t('Available') : t('Draft')}
                  </span>
                  <span className="template-layout-label">
                    {template.layout === 'menu' ? t('Catalog first') : t('Welcome first')}
                  </span>
                </div>
                <h3>{template.name}</h3>
                <p>{template.description || t('A business storefront design.')}</p>
                <div className="template-card-footer">
                  <span className="template-key">/{template.key}</span>
                  <Button
                    variant="ghost"
                    className="template-edit-link"
                    type="button"
                    onClick={() => edit(template)}
                  >
                    {t('Edit')} <span aria-hidden="true">↗</span>
                  </Button>
                </div>
              </div>
              <span className="template-index">{String(index + 1).padStart(2, '0')}</span>
            </article>
          ))}
        </div>
      )}
      <footer className="library-footnote">
        <span>
          <span className="footnote-dot">✳</span> {templates.length}{' '}
          {templates.length === 1 ? t('design') : t('designs')} {t('in the library')}{' '}
        </span>
        <span>
          {t('Business activities ·')}{' '}
          {templates.filter((template) => template.status === 'available').length}{' '}
          {t('available for discovery')}{' '}
        </span>
      </footer>
    </section>
  );
}
