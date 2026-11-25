import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACTIVITY_FEATURES,
  type ActivityFeature,
  type ActivityFeatureSettings,
  type BusinessActivitySummary,
} from '@waffarly/contracts';
import { AlertTriangle, Pencil } from 'lucide-react';
import { Button, Card, Input, Textarea, useLocale } from '@waffarly/ui';
import { ApiError } from '../../lib/api-client.js';
import { useUpdateBusinessActivityMutation } from './activity-queries.js';

/** Label and short explanation shown for each activity feature switch. */
const featureCopy: Record<ActivityFeature, { label: string; hint: string }> = {
  kitchen: {
    label: 'Kitchen',
    hint: 'Kitchen screen, kitchen tickets, preparation steps and the Kitchen employee role.',
  },
  diningTables: {
    label: 'Dining tables',
    hint: 'POS tables and dine-in orders.',
  },
  delivery: {
    label: 'Delivery',
    hint: 'POS delivery sales, couriers and delivery follow-up.',
  },
};

interface ActivityEditorPanelProps {
  activity: BusinessActivitySummary;
  onClose: () => void;
  onSaved: (name: string) => void;
}

export function ActivityEditorPanel({ activity, onClose, onSaved }: ActivityEditorPanelProps) {
  const { t, errorText, formatDate } = useLocale();
  const mutation = useUpdateBusinessActivityMutation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [name, setName] = useState(activity.name);
  const [description, setDescription] = useState(activity.description);
  const [features, setFeatures] = useState<ActivityFeatureSettings>(activity.features);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, [activity.key]);

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
          features,
          revision: activity.revision,
        },
      });
      onSaved(name.trim());
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 409) setConflict(true);
    }
  }

  return (
    <Card
      className="admin-panel grid content-start admin-stack rounded-2xl border-waffarly-border bg-white text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]"
      aria-labelledby="activity-editor-heading"
      aria-busy={isSaving}
    >
      <div>
        <span
          className="mb-3 grid size-9 place-items-center rounded-xl bg-waffarly-kpi-gold text-waffarly-gold"
          aria-hidden="true"
        >
          <Pencil size={17} />
        </span>
        <h2
          ref={headingRef}
          id="activity-editor-heading"
          tabIndex={-1}
          className="m-0 text-base font-bold"
        >
          {t('Edit activity')}
        </h2>
        <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
          {t('Update the display name, description and features for this business activity.')}
        </p>
        <code
          className="mt-2 inline-block rounded bg-waffarly-input px-2 py-1 text-[10px] text-waffarly-muted"
          dir="ltr"
        >
          {activity.key}
        </code>
      </div>

      {error && !isConflict && (
        <p
          className="m-0 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-3 py-2 text-xs leading-5 text-waffarly-danger"
          role="alert"
        >
          {errorText(error.message)}
        </p>
      )}

      {isConflict && (
        <div
          className="rounded-xl border border-waffarly-gold/25 bg-waffarly-kpi-gold/50 p-3"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={15}
              className="mt-0.5 shrink-0 text-waffarly-gold"
              aria-hidden="true"
            />
            <p className="m-0 text-xs leading-5 text-waffarly-ink">
              {t(
                'Your draft is preserved. Refresh the catalog, then reopen this entry to review the latest values.',
              )}
            </p>
          </div>
        </div>
      )}

      <form className="grid admin-stack" onSubmit={(event) => void save(event)}>
        <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0" disabled={isSaving || isConflict}>
          <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
            <span>{t('Display name')}</span>
            <Input
              required
              maxLength={160}
              value={name}
              onChange={(event) => {
                mutation.reset();
                setName(event.target.value);
              }}
              className="h-10 rounded-xl border-waffarly-border bg-white text-sm"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-waffarly-ink">
            <span>{t('Description')}</span>
            <Textarea
              rows={4}
              maxLength={1000}
              value={description}
              onChange={(event) => {
                mutation.reset();
                setDescription(event.target.value);
              }}
              className="min-h-24 rounded-xl border-waffarly-border bg-white text-sm leading-5"
            />
          </label>
          <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
            <legend className="mb-1 text-xs font-semibold text-waffarly-ink">
              {t('Features for merchants of this activity')}
            </legend>
            {ACTIVITY_FEATURES.map((feature) => {
              const available = activity.availableFeatures[feature];
              return (
                <label
                  key={feature}
                  className="flex items-start gap-2 rounded-xl border border-waffarly-border px-3 py-2 text-xs"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={available && features[feature]}
                    disabled={!available}
                    onChange={(event) => {
                      mutation.reset();
                      setFeatures((current) => ({ ...current, [feature]: event.target.checked }));
                    }}
                  />
                  <span className="grid gap-0.5">
                    <span className="font-semibold text-waffarly-ink">
                      {t(featureCopy[feature].label)}
                    </span>
                    <span className="leading-5 text-waffarly-muted">
                      {available
                        ? t(featureCopy[feature].hint)
                        : t('Not available for this activity.')}
                    </span>
                  </span>
                </label>
              );
            })}
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

      <p className="m-0 text-[10px] leading-4 text-waffarly-muted">
        {activity.updatedAt
          ? t('Last edited by {{name}} on {{date}}', {
              name: activity.updatedBy,
              date: formatDate(activity.updatedAt),
            })
          : t('Using the platform defaults.')}
      </p>
    </Card>
  );
}
