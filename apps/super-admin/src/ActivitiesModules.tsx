import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  ActivitiesModulesCatalog,
  BusinessActivitySummary,
  PlatformModuleKey,
  PlatformModuleSummary,
  UpdateBusinessActivityRequest,
  UpdatePlatformModuleRequest,
} from '@waffarly/contracts';
import { ApiError, apiRequest } from './lib/api-client.js';
import './activities-modules.css';

type Editor =
  | { kind: 'activity'; entry: BusinessActivitySummary }
  | { kind: 'module'; entry: PlatformModuleSummary };
const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'Could not update the catalog.';

export function ActivitiesModules() {
  const [catalog, setCatalog] = useState<ActivitiesModulesCatalog>({ activities: [], modules: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [moduleKeys, setModuleKeys] = useState<PlatformModuleKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    void apiRequest<ActivitiesModulesCatalog>('/admin/activities-modules')
      .then((data) => {
        if (active) {
          setCatalog(data);
          setLoadError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(message(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    if (editor) editorHeading.current?.focus();
  }, [editor]);

  const modules = useMemo(() => {
    const search = query.trim().toLowerCase();
    return catalog.modules.filter((entry) =>
      `${entry.key} ${entry.name} ${entry.description}`.toLowerCase().includes(search),
    );
  }, [catalog.modules, query]);

  function edit(next: Editor) {
    setEditor(next);
    setName(next.entry.name);
    setDescription(next.entry.description);
    setModuleKeys(next.kind === 'activity' ? [...next.entry.moduleKeys] : []);
    setError('');
    setNotice('');
    setConflict(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving || loading || loadError || conflict) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const settings: UpdatePlatformModuleRequest = {
        name,
        description,
        revision: editor.entry.revision,
      };
      if (editor.kind === 'activity') {
        const body: UpdateBusinessActivityRequest = { ...settings, moduleKeys };
        const saved = await apiRequest<BusinessActivitySummary>(
          `/admin/activities-modules/activities/${editor.entry.key}`,
          { method: 'PATCH', body: JSON.stringify(body) },
        );
        setCatalog((current) => ({
          ...current,
          activities: current.activities.map((entry) => (entry.key === saved.key ? saved : entry)),
        }));
      } else {
        const saved = await apiRequest<PlatformModuleSummary>(
          `/admin/activities-modules/modules/${editor.entry.key}`,
          { method: 'PATCH', body: JSON.stringify(settings) },
        );
        setCatalog((current) => ({
          ...current,
          modules: current.modules.map((entry) => (entry.key === saved.key ? saved : entry)),
        }));
      }
      setNotice(`${name.trim()} updated.`);
      setEditor(null);
    } catch (cause) {
      setError(message(cause));
      if (cause instanceof ApiError && cause.statusCode === 409) setConflict(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="activities-heading">
      <div className="library-heading">
        <div>
          <span className="eyebrow">Business activities & modules</span>
          <h2 id="activities-heading">Activities & capabilities</h2>
          <p>Manage catalog information and the capabilities that apply to restaurants.</p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={loading || saving}
          onClick={() => {
            setLoading(true);
            setReload((value) => value + 1);
          }}
        >
          Refresh catalog
        </button>
      </div>
      <p className="capability-note">
        Activity applicability describes compatibility. Saving it does not change a merchant’s
        subscription or access.
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}
      {loading && <p role="status">Loading activities and modules…</p>}
      <div className={`capability-columns ${editor ? 'with-editor' : ''}`}>
        <div className="capability-catalog" aria-busy={loading}>
          <section className="panel" aria-labelledby="activity-list-heading">
            <div className="capability-section-heading">
              <h3 id="activity-list-heading">Business activities</h3>
              <span>{catalog.activities.length} supported</span>
            </div>
            {!loading && !loadError && catalog.activities.length === 0 && (
              <p>No supported activities are configured.</p>
            )}
            {catalog.activities.map((activity) => (
              <article className="capability-card" key={activity.key}>
                <div className="capability-section-heading">
                  <h3>{activity.name}</h3>
                  <span className="template-status status-available">Initial activity</span>
                </div>
                <p>{activity.description}</p>
                <div className="capability-tags" aria-label="Applicable modules">
                  {activity.moduleKeys.map((key) => (
                    <span key={key}>
                      {catalog.modules.find((entry) => entry.key === key)?.name ?? key}
                    </span>
                  ))}
                  {activity.moduleKeys.length === 0 && <span>No modules associated</span>}
                </div>
                <div className="capability-footer">
                  <code>{activity.key}</code>
                  <button
                    className="secondary"
                    type="button"
                    disabled={loading || saving || Boolean(loadError)}
                    onClick={() => edit({ kind: 'activity', entry: activity })}
                  >
                    Edit activity
                  </button>
                </div>
              </article>
            ))}
          </section>
          <section className="panel" aria-labelledby="module-list-heading">
            <div className="capability-section-heading">
              <h3 id="module-list-heading">Platform modules</h3>
              <span>{catalog.modules.length} implemented</span>
            </div>
            <label className="capability-search">
              Search modules
              <input
                type="search"
                value={query}
                placeholder="Search by name, key, or description"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {!loading && !loadError && modules.length === 0 && (
              <p>
                {catalog.modules.length
                  ? 'No modules match your search.'
                  : 'No supported modules are configured.'}
              </p>
            )}
            {modules.map((module) => (
              <article className="capability-card" key={module.key}>
                <div className="capability-section-heading">
                  <h3>{module.name}</h3>
                  <span className="template-status status-available">Implemented</span>
                </div>
                <p>{module.description}</p>
                <p className="capability-detail">
                  Applies to:{' '}
                  {catalog.activities
                    .filter((activity) => activity.moduleKeys.includes(module.key))
                    .map((activity) => activity.name)
                    .join(', ') || 'No activities associated'}
                </p>
                <p className="capability-detail">
                  Dependencies:{' '}
                  {module.dependencies
                    .map((key) => catalog.modules.find((entry) => entry.key === key)?.name ?? key)
                    .join(', ') || 'None'}
                </p>
                <div className="capability-footer">
                  <code>{module.key}</code>
                  <button
                    className="secondary"
                    type="button"
                    disabled={loading || saving || Boolean(loadError)}
                    onClick={() => edit({ kind: 'module', entry: module })}
                    aria-label={`Edit ${module.name}`}
                  >
                    Edit module
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
        {editor && (
          <section className="panel capability-editor" aria-labelledby="capability-editor-heading">
            <span className="eyebrow">
              {editor.kind === 'activity' ? 'Activity details' : 'Module details'}
            </span>
            <h3 ref={editorHeading} id="capability-editor-heading" tabIndex={-1}>
              Edit {editor.entry.name}
            </h3>
            <p className="capability-detail">
              Identifier: <code>{editor.entry.key}</code>
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <form className="form" onSubmit={(event) => void save(event)}>
              <fieldset
                className="capability-fields"
                disabled={saving || loading || Boolean(loadError)}
              >
                <label>
                  Display name
                  <input
                    required
                    maxLength={160}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={4}
                    maxLength={1000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                {editor.kind === 'activity' && (
                  <fieldset className="capability-options">
                    <legend>Applicable modules</legend>
                    {catalog.modules
                      .filter((module) => module.supportedActivities.includes(editor.entry.key))
                      .map((module) => (
                        <label key={module.key}>
                          <input
                            type="checkbox"
                            checked={moduleKeys.includes(module.key)}
                            onChange={(event) =>
                              setModuleKeys((current) =>
                                event.target.checked
                                  ? [...current, module.key]
                                  : current.filter((key) => key !== module.key),
                              )
                            }
                          />
                          <span>{module.name}</span>
                        </label>
                      ))}
                  </fieldset>
                )}
                <div className="template-form-actions">
                  <button type="submit" disabled={conflict}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" className="secondary" onClick={() => setEditor(null)}>
                    Cancel
                  </button>
                </div>
                {conflict && (
                  <p className="capability-detail">
                    Your draft is preserved. Refresh the catalog, then reopen this entry to review
                    the latest values.
                  </p>
                )}
                <p className="capability-detail">
                  {editor.entry.updatedAt
                    ? `Last edited by ${editor.entry.updatedBy} on ${new Date(editor.entry.updatedAt).toLocaleDateString()}`
                    : 'Using the platform defaults.'}
                </p>
              </fieldset>
            </form>
          </section>
        )}
      </div>
    </section>
  );
}
