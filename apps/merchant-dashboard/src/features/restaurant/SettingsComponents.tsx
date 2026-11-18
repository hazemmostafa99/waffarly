import { Button, useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';

export interface SettingsEditorActions {
  save: () => Promise<boolean>;
  discard: () => void;
}

export function SettingsHeading({ id, icon, title }: {
  id: string;
  icon: string;
  title: string;
}) {
  return (
    <div className="rs-card-heading">
      <span className="rs-section-icon" aria-hidden="true"><Icon name={icon} /></span>
      <div>
        <h2 id={id}>{title}</h2>
      </div>
    </div>
  );
}

export function SettingsFeedback({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error && <p className="rs-feedback rs-feedback-error" role="alert">{error}</p>}
      {notice && <p className="rs-feedback rs-feedback-notice" role="status">{notice}</p>}
    </>
  );
}

export function SettingsSaveBar({ dirty, operation, invalid, label, onDiscard }: {
  dirty: boolean;
  operation: 'saving' | 'uploading' | null;
  invalid: boolean;
  label: string;
  onDiscard: () => void;
}) {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const busy = operation !== null;
  let status = ar ? 'كل التغييرات محفوظة' : 'All changes saved';
  if (dirty) status = ar ? 'تغييرات غير محفوظة' : 'Unsaved changes';
  if (operation === 'uploading') status = ar ? 'جارٍ رفع الصورة…' : 'Uploading image…';
  if (operation === 'saving') status = ar ? 'جارٍ الحفظ…' : 'Saving…';

  return (
    <footer className="rs-savebar">
      <span role="status"><i aria-hidden="true" className={dirty ? 'is-dirty' : ''} />{status}</span>
      <div>
        <Button type="button" variant="outline" disabled={busy || !dirty} onClick={onDiscard}>
          {ar ? 'تراجع عن التغييرات' : 'Discard changes'}
        </Button>
        <Button type="submit" variant="solid" disabled={busy || !dirty || invalid}>{label}</Button>
      </div>
    </footer>
  );
}
