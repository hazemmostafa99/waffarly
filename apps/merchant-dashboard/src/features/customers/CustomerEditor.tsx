import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useBlocker } from 'react-router-dom';
import type { MerchantCustomer } from '@waffarly/contracts';
import { Button, Input, useLocale } from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { ApiError, apiRequestSingle } from '../../lib/api-client.js';

type Command = { path: string; method: string; body: string };

export function CustomerEditor({
  customer,
  onClose,
  onSaved,
  onReload,
}: {
  customer: MerchantCustomer | null;
  onClose: () => void;
  onSaved: (customer: MerchantCustomer) => void;
  onReload: () => void;
}) {
  const { locale, errorText } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const initial = {
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    notes: customer?.notes ?? '',
    segment: customer?.segment ?? 'regular',
  };
  const [draft, setDraft] = useState(initial);
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const sending = useRef(false);
  const completed = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const locked = busy || pending !== null || conflict;
  const blocker = useBlocker(() => !completed.current && (dirty || pending !== null));
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pending]);

  function close() {
    if (busy || pending) return;
    if (
      !dirty ||
      window.confirm(
        text('Discard unsaved customer changes?', 'تجاهل تعديلات العميل غير المحفوظة؟'),
      )
    )
      onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || conflict) return;
    sending.current = true;
    setBusy(true);
    setError('');
    const data = {
      ...draft,
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      notes: draft.notes.trim(),
    };
    const command = pending ?? {
      path: customer ? `/owner/customers/${customer.id}` : '/owner/customers',
      method: customer ? 'PATCH' : 'POST',
      body: JSON.stringify({
        ...data,
        ...(customer ? { revision: customer.revision } : { requestId }),
      }),
    };
    setPending(command);
    try {
      const saved = await apiRequestSingle<MerchantCustomer>(command.path, {
        method: command.method,
        body: command.body,
      });
      completed.current = true;
      setPending(null);
      onSaved(saved);
    } catch (cause) {
      const definitive =
        cause instanceof ApiError && cause.statusCode >= 400 && cause.statusCode < 500;
      if (definitive) setPending(null);
      if (cause instanceof ApiError && cause.statusCode === 409) {
        setConflict(true);
        setError(
          text(
            'The saved record has changed. Discard these edits and reload before saving again.',
            'البيانات المحفوظة اتغيّرت. تجاهل التعديلات وحمّل أحدث نسخة قبل الحفظ.',
          ),
        );
      } else {
        setError(
          definitive && cause instanceof Error
            ? errorText(cause.message)
            : text(
                'The result is uncertain. Retry the same save before making more changes.',
                'نتيجة الحفظ مش مؤكدة. أعد نفس المحاولة قبل إجراء تعديلات جديدة.',
              ),
        );
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <DashboardDialog
      title={customer ? text('Edit customer', 'تعديل العميل') : text('Add customer', 'إضافة عميل')}
      closeLabel={text('Close', 'إغلاق')}
      onClose={close}
      busy={busy || pending !== null}
      className="cd-editor-dialog"
    >
      <form className="cd-editor" onSubmit={(event) => void submit(event)} aria-busy={busy}>
        <p className="cd-muted">
          {text(
            'These contact details and notes are visible only within your store.',
            'بيانات التواصل والملاحظات دي خاصة بمتجرك.',
          )}
        </p>
        {error && (
          <p className="cd-error" role="alert">
            {error}
          </p>
        )}
        <fieldset disabled={locked}>
          <label>
            {text('Customer name', 'اسم العميل')}
            <Input
              autoFocus
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <div className="cd-field-grid">
            <label>
              {text('Phone (optional)', 'الموبايل (اختياري)')}
              <Input
                type="tel"
                dir="ltr"
                minLength={7}
                maxLength={32}
                pattern="[+0-9 ().\-]+"
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              />
            </label>
            <label>
              {text('Email (optional)', 'البريد الإلكتروني (اختياري)')}
              <Input
                type="email"
                dir="ltr"
                maxLength={254}
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              />
            </label>
          </div>
          <label>
            {text('Segment', 'التصنيف')}
            <select
              value={draft.segment}
              onChange={(event) =>
                setDraft({ ...draft, segment: event.target.value as 'regular' | 'vip' })
              }
            >
              <option value="regular">{text('Regular customer', 'عميل عادي')}</option>
              <option value="vip">VIP</option>
            </select>
          </label>
          <label>
            {text('Private notes', 'ملاحظات خاصة')}
            <textarea
              rows={4}
              maxLength={2000}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
        </fieldset>
        {conflict && (
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              onReload();
              onClose();
            }}
          >
            {text('Discard edits and reload', 'تجاهل التعديلات وتحميل الأحدث')}
          </Button>
        )}
        {blocker.state === 'blocked' && (
          <div className="cd-error" role="alert">
            <p>
              {text(
                'There are unsaved changes. Stay here to finish saving.',
                'عندك تعديلات غير محفوظة. كمّل الحفظ قبل المغادرة.',
              )}
            </p>
            <Button type="button" variant="outline" onClick={() => blocker.reset()}>
              {text('Stay here', 'البقاء هنا')}
            </Button>
            {!busy && !pending && (
              <Button type="button" variant="ghost" onClick={() => blocker.proceed()}>
                {text('Discard and leave', 'تجاهل ومغادرة')}
              </Button>
            )}
          </div>
        )}
        <footer className="cd-editor-footer">
          <Button
            type="button"
            variant="outline"
            disabled={busy || pending !== null}
            onClick={close}
          >
            {text('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" disabled={busy || conflict || (!dirty && !!customer)}>
            {busy
              ? text('Saving…', 'جاري الحفظ…')
              : pending
                ? text('Retry same save', 'إعادة نفس الحفظ')
                : text('Save customer', 'حفظ العميل')}
          </Button>
        </footer>
      </form>
    </DashboardDialog>
  );
}
