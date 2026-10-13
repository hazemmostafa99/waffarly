import type { LocalizedMessage } from '@waffarly/ui';
import { useLocale, Button, Input, Card, Textarea } from '@waffarly/ui';
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
  const { t, formatDate, errorText } = useLocale();
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
  const [notice, setNotice] = useState<LocalizedMessage>('');
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
      setNotice({ key: '{{name}} updated.', values: { name: name.trim() } });
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
          <span className="eyebrow">{t('Business activities & modules')}</span>
          <h2 id="activities-heading">{t('Activities & capabilities')}</h2>
          <p>{t('Manage catalog information and the capabilities that apply to businesses.')}</p>
        </div>
        <Button
          variant="outline"
          type="button"
          className="secondary"
          disabled={loading || saving}
          onClick={() => {
            setLoading(true);
            setReload((value) => value + 1);
          }}
        >
          {t('Refresh catalog')}{' '}
        </Button>
      </div>
      <p className="capability-note">
        {t(
          'Activity applicability describes compatibility. Saving it does not change a merchant’s subscription or access.',
        )}{' '}
      </p>
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
      {loadError && (
        <p className="error" role="alert">
          {errorText(loadError)}
        </p>
      )}
      {loading && <p role="status">{t('Loading activities and modules…')}</p>}
      <div className={`capability-columns ${editor ? 'with-editor' : ''}`}>
        <div className="capability-catalog" aria-busy={loading}>
          <Card className="panel" aria-labelledby="activity-list-heading">
            <div className="capability-section-heading">
              <h3 id="activity-list-heading">{t('Business activities')}</h3>
              <span>
                {catalog.activities.length} {t('supported')}
              </span>
            </div>
            {!loading && !loadError && catalog.activities.length === 0 && (
              <p>{t('No supported activities are configured.')}</p>
            )}
            {catalog.activities.map((activity) => (
              <article className="capability-card" key={activity.key}>
                <div className="capability-section-heading">
                  <h3>{activity.name}</h3>
                  <span className="template-status status-available">{t('Initial activity')}</span>
                </div>
                <p>{activity.description}</p>
                <div className="capability-tags" aria-label={t('Applicable modules')}>
                  {activity.moduleKeys.map((key) => (
                    <span key={key}>
                      {catalog.modules.find((entry) => entry.key === key)?.name ?? key}
                    </span>
                  ))}
                  {activity.moduleKeys.length === 0 && <span>{t('No modules associated')}</span>}
                </div>
                <div className="capability-footer">
                  <code>{activity.key}</code>
                  <Button
                    variant="outline"
                    className="secondary"
                    type="button"
                    disabled={loading || saving || Boolean(loadError)}
                    onClick={() => edit({ kind: 'activity', entry: activity })}
                  >
                    {t('Edit activity')}{' '}
                  </Button>
                </div>
              </article>
            ))}
          </Card>
          <Card className="panel" aria-labelledby="module-list-heading">
            <div className="capability-section-heading">
              <h3 id="module-list-heading">{t('Platform modules')}</h3>
              <span>
                {catalog.modules.length} {t('implemented')}
              </span>
            </div>
            <label className="capability-search">
              {t('Search modules')}{' '}
              <Input
                type="search"
                value={query}
                placeholder={t('Search by name, key, or description')}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {!loading && !loadError && modules.length === 0 && (
              <p>
                {catalog.modules.length
                  ? t('No modules match your search.')
                  : t('No supported modules are configured.')}
              </p>
            )}
            {modules.map((module) => (
              <article className="capability-card" key={module.key}>
                <div className="capability-section-heading">
                  <h3>{module.name}</h3>
                  <span className="template-status status-available">{t('Implemented')}</span>
                </div>
                <p>{module.description}</p>
                <p className="capability-detail">
                  {t('Applies to:')}{' '}
                  {catalog.activities
                    .filter((activity) => activity.moduleKeys.includes(module.key))
                    .map((activity) => activity.name)
                    .join(', ') || t('No activities associated')}
                </p>
                <p className="capability-detail">
                  {t('Dependencies:')}{' '}
                  {module.dependencies
                    .map((key) => catalog.modules.find((entry) => entry.key === key)?.name ?? key)
                    .join(', ') || t('None')}
                </p>
                <div className="capability-footer">
                  <code>{module.key}</code>
                  <Button
                    variant="outline"
                    className="secondary"
                    type="button"
                    disabled={loading || saving || Boolean(loadError)}
                    onClick={() => edit({ kind: 'module', entry: module })}
                    aria-label={t('Edit {{name}}', { name: module.name })}
                  >
                    {t('Edit module')}{' '}
                  </Button>
                </div>
              </article>
            ))}
          </Card>
        </div>
        {editor && (
          <Card className="panel capability-editor" aria-labelledby="capability-editor-heading">
            <span className="eyebrow">
              {editor.kind === 'activity' ? t('Activity details') : t('Module details')}
            </span>
            <h3 ref={editorHeading} id="capability-editor-heading" tabIndex={-1}>
              {t('Edit')} {editor.entry.name}
            </h3>
            <p className="capability-detail">
              {t('Identifier:')} <code>{editor.entry.key}</code>
            </p>
            {error && (
              <p className="error" role="alert">
                {errorText(error)}
              </p>
            )}
            <form className="form" onSubmit={(event) => void save(event)}>
              <fieldset
                className="capability-fields"
                disabled={saving || loading || Boolean(loadError)}
              >
                <label>
                  {t('Display name')}{' '}
                  <Input
                    required
                    maxLength={160}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  {t('Description')}{' '}
                  <Textarea
                    rows={4}
                    maxLength={1000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                {editor.kind === 'activity' && (
                  <fieldset className="capability-options">
                    <legend>{t('Applicable modules')}</legend>
                    {catalog.modules
                      .filter((module) => module.supportedActivities.includes(editor.entry.key))
                      .map((module) => (
                        <label key={module.key}>
                          <Input
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
                  <Button type="submit" disabled={conflict}>
                    {saving ? t('Saving…') : t('Save changes')}
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    className="secondary"
                    onClick={() => setEditor(null)}
                  >
                    {t('Cancel')}{' '}
                  </Button>
                </div>
                {conflict && (
                  <p className="capability-detail">
                    {t(
                      'Your draft is preserved. Refresh the catalog, then reopen this entry to review the latest values.',
                    )}{' '}
                  </p>
                )}
                <p className="capability-detail">
                  {editor.entry.updatedAt
                    ? t('Last edited by {{name}} on {{date}}', {
                        name: editor.entry.updatedBy,
                        date: formatDate(editor.entry.updatedAt),
                      })
                    : t('Using the platform defaults.')}
                </p>
              </fieldset>
            </form>
          </Card>
        )}
      </div>
    </section>
  );
}
