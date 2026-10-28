import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { BusinessActivitySummary, PlatformModuleKey, PlatformModuleSummary } from '@waffarly/contracts';
import { AlertTriangle, Pencil, ShieldCheck } from 'lucide-react';
import { Button, Card, Input, Textarea, useLocale } from '@waffarly/ui';
import { ApiError } from '../../lib/api-client.js';
import { useUpdateBusinessActivityMutation } from '../activity-modules/activity-modules-queries.js';

interface ActivityEditorPanelProps {
  activity: BusinessActivitySummary;
  modules: PlatformModuleSummary[];
  onClose: () => void;
  onSaved: (name: string) => void;
}

export function ActivityEditorPanel({ activity, modules, onClose, onSaved }: ActivityEditorPanelProps) {
  const { t, errorText, formatDate } = useLocale();
  const mutation = useUpdateBusinessActivityMutation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [name, setName] = useState(activity.name);
  const [description, setDescription] = useState(activity.description);
  const [moduleKeys, setModuleKeys] = useState<PlatformModuleKey[]>([...activity.moduleKeys]);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, [activity.key]);

  const supportedModules = modules.filter((module) => module.supportedActivities.includes(activity.key));
  const isSaving = mutation.isPending;
  const error = mutation.error;
  const isConflict = conflict || (error instanceof ApiError && error.statusCode === 409);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || isConflict) return;

    try {
      await mutation.mutateAsync({
        key: activity.key,
        body: {
          name: name.trim(),
          description: description.trim(),
          moduleKeys,
          revision: activity.revision,
        },
      });
      onSaved(name.trim());
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 409) setConflict(true);
    }
  }

  function toggleModule(key: PlatformModuleKey, checked: boolean) {
    mutation.reset();
    setConflict(false);
    setModuleKeys((current) => checked
      ? [...current, key]
      : current.filter((selected) => selected !== key));
  }

  return (
    <Card className="admin-panel grid content-start admin-stack rounded-2xl border-waffarly-border bg-white text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]" aria-labelledby="activity-editor-heading" aria-busy={isSaving}>
      <div>
        <span className="mb-3 grid size-9 place-items-center rounded-xl bg-waffarly-kpi-gold text-waffarly-gold" aria-hidden="true"><Pencil size={17} /></span>
        <h2 ref={headingRef} id="activity-editor-heading" tabIndex={-1} className="m-0 text-base font-bold">{t('Edit activity')}</h2>
        <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Update the display details and saved module associations for this activity.')}</p>
        <code className="mt-2 inline-block rounded bg-waffarly-input px-2 py-1 text-[10px] text-waffarly-muted" dir="ltr">{activity.key}</code>
      </div>

      {error && !isConflict && (
        <p className="m-0 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-3 py-2 text-xs leading-5 text-waffarly-danger" role="alert">
          {errorText(error.message)}
        </p>
      )}

      {isConflict && (
        <div className="rounded-xl border border-waffarly-gold/25 bg-waffarly-kpi-gold/50 p-3" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-waffarly-gold" aria-hidden="true" />
            <p className="m-0 text-xs leading-5 text-waffarly-ink">{t('Your draft is preserved. Refresh the catalog, then reopen this entry to review the latest values.')}</p>
          </div>
        </div>
      )}

      <form className="grid admin-stack" onSubmit={(event) => void save(event)}>
        <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0" disabled={isSaving || isConflict}>
          <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
            <span>{t('Display name')}</span>
            <Input required maxLength={160} value={name} onChange={(event) => { mutation.reset(); setName(event.target.value); }} className="h-10 rounded-xl border-waffarly-border bg-white text-sm" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
            <span>{t('Description')}</span>
            <Textarea rows={4} maxLength={1000} value={description} onChange={(event) => { mutation.reset(); setDescription(event.target.value); }} className="min-h-24 rounded-xl border-waffarly-border bg-white text-sm leading-5" />
          </label>

          <fieldset className="m-0 grid gap-2 rounded-xl border border-waffarly-border p-3">
            <legend className="px-1 text-xs font-bold text-waffarly-ink">{t('Applicable modules')}</legend>
            {supportedModules.map((module) => (
              <label key={module.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 transition hover:bg-waffarly-input/70">
                <Input
                  type="checkbox"
                  checked={moduleKeys.includes(module.key)}
                  onChange={(event) => toggleModule(module.key, event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-waffarly-primary"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-waffarly-ink">{t(module.name)}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-waffarly-muted">{t(module.description)}</span>
                </span>
              </label>
            ))}
            {supportedModules.length === 0 && <p className="m-0 text-xs text-waffarly-muted">{t('No supported modules are configured.')}</p>}
          </fieldset>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSaving || isConflict}>
            {isSaving ? t('Saving…') : t('Save changes')}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            {t('Cancel')}
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-waffarly-success/15 bg-waffarly-kpi-mint/50 p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-waffarly-success" aria-hidden="true" />
          <p className="m-0 text-[10px] leading-5 text-waffarly-muted">{t('Only supported module links can be saved. This does not change plan entitlements or merchant access.')}</p>
        </div>
      </div>

      <p className="m-0 text-[10px] leading-4 text-waffarly-muted">
        {activity.updatedAt
          ? t('Last edited by {{name}} on {{date}}', { name: activity.updatedBy, date: formatDate(activity.updatedAt) })
          : t('Using the platform defaults.')}
      </p>
    </Card>
  );
}
