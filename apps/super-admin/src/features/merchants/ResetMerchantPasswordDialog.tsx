/** Keeps reset credentials transient and sends one explicit request for the selected owner. */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type {
  MerchantSummary,
  ResetMerchantOwnerPasswordRequest,
  ResetMerchantOwnerPasswordResponse,
} from '@waffarly/contracts';
import { Button, Dialog, PasswordInput, useLocale } from '@waffarly/ui';
import { ApiError, apiRequest } from '../../lib/api-client.js';

export function ResetMerchantPasswordDialog({
  merchant,
  onClose,
}: {
  merchant: MerchantSummary;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const ar = locale === 'ar';
  const id = useId();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function close() {
    // Closing cannot cancel a password change already being processed by the server.
    if (submitting.current) return;
    setPassword('');
    setConfirmation('');
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || succeeded) return;
    if (password.length < 12 || password.length > 128) {
      setError(
        ar ? 'كلمة المرور لازم تكون من ١٢ لـ١٢٨ حرف.' : 'Use 12–128 characters for the password.',
      );
      return;
    }
    if (password !== confirmation) {
      setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }

    submitting.current = true;
    setPending(true);
    setError('');
    try {
      // Do not put passwords in query caches, browser storage or automatic retry state.
      const input: ResetMerchantOwnerPasswordRequest = { password };
      await apiRequest<ResetMerchantOwnerPasswordResponse>(
        `/admin/merchants/${merchant.id}/owner-password/reset`,
        { method: 'POST', body: JSON.stringify(input) },
      );
      if (mounted.current) setSucceeded(true);
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof ApiError && cause.statusCode === 401) {
        setError(ar
          ? 'جلسة Super Admin انتهت. سجّل دخولك تاني.'
          : 'Your Super Admin session expired. Sign in again.');
      } else if (cause instanceof ApiError && cause.statusCode === 404) {
        setError(ar
          ? 'حساب التاجر مش موجود. حدّث قائمة التجار.'
          : 'The owner account was not found. Refresh the merchant list.');
      } else if (cause instanceof ApiError && cause.statusCode < 500) {
        setError(ar
          ? 'الطلب اترفض. راجع صلاحياتك والبيانات وحاول تاني.'
          : 'The request was rejected. Check your access and the entered details.');
      } else {
        setError(ar
          ? 'تعذر تأكيد نتيجة التغيير. ممكن يكون تم بالفعل؛ جرّب تسجيل الدخول بالباسورد اللي اخترته قبل إرسال طلب جديد.'
          : 'The reset result could not be confirmed. It may have succeeded; try signing in with your chosen password before sending another reset.');
      }
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setPassword('');
        setConfirmation('');
        setPending(false);
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={ar ? 'إعادة تعيين كلمة مرور التاجر' : 'Reset merchant password'}
      closeLabel={ar ? 'إغلاق' : 'Close'}
      className="admin-dialog"
    >
      <div className="admin-section grid admin-stack" dir={ar ? 'rtl' : 'ltr'}>
        <dl className="m-0 grid gap-3 sm:grid-cols-2">
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs text-waffarly-muted">{ar ? 'النشاط' : 'Business'}</dt>
            <dd className="m-0 break-words text-sm font-semibold">
              <bdi>{merchant.name}</bdi>
            </dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs text-waffarly-muted">{ar ? 'اسم المستخدم' : 'Username'}</dt>
            <dd className="m-0 break-all text-sm font-semibold">
              <bdi dir="ltr">{merchant.username}</bdi>
            </dd>
          </div>
        </dl>

        {succeeded ? (
          <>
            <p role="status" className="m-0 rounded-xl bg-waffarly-kpi-mint p-3 text-sm text-waffarly-primary">
              {ar
                ? 'تم تغيير كلمة المرور وإنهاء جلسات التاجر الحالية. يقدر يسجّل دخول بالباسورد الجديد.'
                : 'Password reset. Existing owner sessions were ended. The owner can sign in with the new password.'}
            </p>
            <Button type="button" onClick={close}>
              {ar ? 'تم' : 'Done'}
            </Button>
          </>
        ) : (
          <form
            className="grid admin-stack"
            onSubmit={(event) => void submit(event)}
            aria-busy={pending}
          >
            <p id={`${id}-notice`} className="m-0 rounded-xl bg-waffarly-input p-3 text-sm leading-6 text-waffarly-muted">
              {ar
                ? 'التأكيد هيغيّر كلمة مرور حساب التاجر وينهي جلساته الحالية. احتفظ بالباسورد الجديد ووصّله لصاحب الحساب بشكل خاص.'
                : 'Confirming changes the owner password and ends their current sessions. Keep your chosen password and share it privately with the owner.'}
            </p>
            <label className="grid gap-2 text-sm font-medium" htmlFor={`${id}-password`}>
              {ar ? 'كلمة المرور الجديدة' : 'New password'}
            </label>
            <PasswordInput
              id={`${id}-password`}
              autoComplete="new-password"
              value={password}
              required
              minLength={12}
              maxLength={128}
              disabled={pending}
              aria-describedby={`${id}-hint ${id}-notice`}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
            />
            <small id={`${id}-hint`} className="text-waffarly-muted">
              {ar
                ? 'من ١٢ لـ١٢٨ حرف، مع الحفاظ على المسافات كما كتبتها.'
                : '12–128 characters. Spaces are preserved exactly as entered.'}
            </small>
            <label className="text-sm font-medium" htmlFor={`${id}-confirmation`}>
              {ar ? 'تأكيد كلمة المرور' : 'Confirm password'}
            </label>
            <PasswordInput
              id={`${id}-confirmation`}
              autoComplete="new-password"
              value={confirmation}
              required
              minLength={12}
              maxLength={128}
              disabled={pending}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setError('');
              }}
            />
            {error && (
              <p role="alert" className="m-0 text-sm text-waffarly-danger">{error}</p>
            )}
            {pending && (
              <p role="status" className="m-0 text-xs text-waffarly-muted">
                {ar
                  ? 'جارٍ الحفظ؛ انتظر النتيجة قبل إغلاق النافذة.'
                  : 'Saving; wait for the result before closing this dialog.'}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-waffarly-border pt-3">
              <Button type="button" variant="outline" disabled={pending} onClick={close}>
                {ar ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'تأكيد تغيير كلمة المرور' : 'Confirm password reset')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
