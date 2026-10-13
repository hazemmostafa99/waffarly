import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CreateStorefrontTemplateRequest,
  StorefrontTemplateSummary,
  TemplateLayout,
  TemplateStatus,
  UpdateStorefrontTemplateRequest,
} from '@waffarly/contracts';
import { StorefrontDesignPreview } from '@waffarly/ui';
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
  return (
    <StorefrontDesignPreview
      className="storefront-preview"
      layout={layout}
      name={name || 'Your restaurant'}
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
          <span className="eyebrow">{initial.key ? 'EDIT TEMPLATE' : 'NEW DESIGN'}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close editor"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <label>
          Display name
          <input
            autoFocus
            maxLength={160}
            required
            value={form.name}
            placeholder="Sunday Table"
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
        <label>
          Library key<small>Permanent identifier for this design</small>
          <input
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
          Description <small>Shown to administrators in the library</small>
          <textarea
            maxLength={1000}
            rows={3}
            value={form.description}
            placeholder="A relaxed layout that puts your menu first."
            onChange={(event) => update('description', event.target.value)}
          />
        </label>
        <label>
          Restaurant layout
          <select
            value={form.layout}
            onChange={(event) => update('layout', event.target.value as TemplateLayout)}
          >
            <option value="menu">Menu first · editorial grid</option>
            <option value="hero">Welcome first · featured menu</option>
          </select>
        </label>
        <label>
          Accent color
          <div className="template-color-field">
            <input
              aria-label="Accent color"
              type="color"
              value={form.accentColor}
              onChange={(event) => update('accentColor', event.target.value)}
            />
            <span>{form.accentColor.toUpperCase()}</span>
          </div>
        </label>
        <label>
          Library status
          <select
            value={form.status}
            onChange={(event) => update('status', event.target.value as TemplateStatus)}
          >
            <option value="draft">Draft · only admins can see it</option>
            <option value="available">Available · ready for future merchant selection</option>
          </select>
        </label>
        <p className="template-form-note">
          A restaurant preview using sample content. Availability adds this design to the library;
          it does not publish a restaurant storefront.
        </p>
        <div className="template-form-actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : initial.key ? 'Save changes' : 'Create template'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setShowPreview((current) => !current)}
          >
            {showPreview ? 'Hide preview' : 'Preview design'}
          </button>
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
  const [templates, setTemplates] = useState<StorefrontTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
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
        setNotice(`${saved.name} updated.`);
      } else {
        const saved = await apiRequest<StorefrontTemplateSummary>('/admin/templates', {
          method: 'POST',
          body: JSON.stringify(draft),
        });
        setTemplates((current) => [saved, ...current]);
        setNotice(`${saved.name} added to the library.`);
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
          <span className="eyebrow">STOREFRONT · RESTAURANTS</span>
          <h2 id="library-heading">The design library</h2>
          <p>Curate the restaurant designs merchants can discover.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(emptyTemplate);
            setEditing(null);
            setNotice('');
            setError('');
          }}
        >
          ＋ Add a template
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="library-toolbar">
        <div className="template-filters" aria-label="Filter templates">
          <button
            type="button"
            className={filter === 'all' ? 'filter-active' : ''}
            onClick={() => setFilter('all')}
          >
            All <span>{templates.length}</span>
          </button>
          <button
            type="button"
            className={filter === 'available' ? 'filter-active' : ''}
            onClick={() => setFilter('available')}
          >
            Available{' '}
            <span>{templates.filter((template) => template.status === 'available').length}</span>
          </button>
          <button
            type="button"
            className={filter === 'draft' ? 'filter-active' : ''}
            onClick={() => setFilter('draft')}
          >
            Drafts <span>{templates.filter((template) => template.status === 'draft').length}</span>
          </button>
        </div>
        <input
          className="template-search"
          aria-label="Search templates"
          placeholder="Search the library"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="secondary refresh-button"
          onClick={() => void reload()}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
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
          <p>Loading your design library…</p>
        </div>
      ) : visibleTemplates.length === 0 ? (
        <div className="library-empty">
          <span className="empty-mark">✳</span>
          <h3>
            {query || filter !== 'all'
              ? 'No designs match that search'
              : 'Your library starts here'}
          </h3>
          <p>
            {query || filter !== 'all'
              ? 'Try another name or status.'
              : 'Add a restaurant design to start curating what merchants can discover.'}
          </p>
          {!query && filter === 'all' && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setDraft(emptyTemplate);
                setEditing(null);
              }}
            >
              Create the first template
            </button>
          )}
        </div>
      ) : (
        <div className="template-grid">
          {visibleTemplates.map((template, index) => (
            <article className="template-card" key={template.id}>
              <button
                className="template-art"
                type="button"
                aria-label={`Preview ${template.name}`}
                onClick={() => edit(template)}
              >
                <StorefrontPreview
                  layout={template.layout}
                  name={template.name}
                  description={template.description}
                  accentColor={template.accentColor}
                />
                <span className="art-overlay">
                  View & edit design <span aria-hidden="true">↗</span>
                </span>
              </button>
              <div className="template-card-copy">
                <div className="template-card-meta">
                  <span className={`template-status status-${template.status}`}>
                    <span aria-hidden="true">●</span>
                    {template.status === 'available' ? 'Available' : 'Draft'}
                  </span>
                  <span className="template-layout-label">
                    {template.layout === 'menu' ? 'Menu first' : 'Welcome first'}
                  </span>
                </div>
                <h3>{template.name}</h3>
                <p>{template.description || 'A restaurant storefront design.'}</p>
                <div className="template-card-footer">
                  <span className="template-key">/{template.key}</span>
                  <button
                    className="template-edit-link"
                    type="button"
                    onClick={() => edit(template)}
                  >
                    Edit <span aria-hidden="true">↗</span>
                  </button>
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
          {templates.length === 1 ? 'design' : 'designs'} in the library
        </span>
        <span>
          Restaurant activity ·{' '}
          {templates.filter((template) => template.status === 'available').length} available for
          discovery
        </span>
      </footer>
    </section>
  );
}
