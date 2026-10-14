import { useLocale, Input, Button, PasswordInput, LanguageSwitcher } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LoginRequest } from '@waffarly/contracts';
import { adminQueryKeys } from './app/query-keys.js';
import { queryClient } from './app/query-client.js';
import { apiRequest } from './lib/api-client.js';
import { adminThemeClass } from './lib/admin-theme.js';

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

export function Login() {
  const { t, errorText, locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const [login, setLogin] = useState<LoginRequest>({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<{ username: string }>('/auth/admin/me')
      .then((profile) => {
        queryClient.setQueryData(adminQueryKeys.profile, profile);
        navigate(destination, { replace: true });
      })
      .catch(() => {});
  }, [navigate, destination]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/admin/login', { method: 'POST', body: JSON.stringify(login) });
      const profile = await apiRequest<{ username: string }>('/auth/admin/me');
      queryClient.setQueryData(adminQueryKeys.profile, profile);
      navigate(destination, { replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={adminThemeClass} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <a className="fixed -top-14 start-4 z-[100] rounded-lg border-2 border-waffarly-primary bg-white px-4 py-3 text-sm font-semibold text-waffarly-primary focus:top-3" href="#main-content">{t('Skip to content')}</a>
      <main id="main-content" tabIndex={-1} className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-16 sm:px-6">
        <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-waffarly-border bg-waffarly-surface/90 px-5 py-3 sm:px-8">
          <span className="grid size-10 place-items-center rounded-xl bg-waffarly-primary text-lg font-bold text-white" aria-hidden="true">W</span>
          <LanguageSwitcher />
        </div>
        <section className="z-10 w-full max-w-[460px] rounded-2xl border border-waffarly-border bg-waffarly-surface p-6 shadow-[0_18px_60px_rgba(20,32,62,0.08)] sm:p-10">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-waffarly-primary text-xl font-bold text-white" aria-hidden="true">W</span>
            <span className="grid gap-0.5"><strong className="text-base text-waffarly-ink">Waffarly</strong><small className={`text-[10px] font-bold text-waffarly-muted ${locale === 'ar' ? '' : 'tracking-[0.16em]'}`}>{t('SUPER ADMIN')}</small></span>
          </div>
          <p className={`mb-2 text-xs font-bold text-waffarly-primary ${locale === 'ar' ? '' : 'uppercase tracking-[0.12em]'}`}>{t('Waffarly platform')}</p>
          <h1 className="m-0 text-3xl font-extrabold tracking-tight text-waffarly-ink">{t('Welcome back')}</h1>
          <p className="mb-7 mt-2 text-sm leading-6 text-waffarly-muted">
            {t('Sign in to review applications, create businesses, and activate their first month.')}
          </p>
          <form className="grid gap-5" onSubmit={(event) => void signIn(event)}>
            <label className="grid gap-2 text-sm font-semibold text-waffarly-ink">
              <span>{t('Username')}</span>
              <Input
                className="h-11 rounded-lg border-waffarly-border bg-waffarly-input px-3 text-waffarly-ink placeholder:text-waffarly-muted focus-visible:ring-waffarly-primary"
                dir="ltr"
                autoComplete="username"
                value={login.username}
                onChange={(event) => setLogin({ ...login, username: event.target.value })}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-waffarly-ink">
              <span>{t('Password')}</span>
              <PasswordInput
                className="h-11 rounded-lg border-waffarly-border bg-waffarly-input px-3 text-waffarly-ink placeholder:text-waffarly-muted focus-visible:ring-waffarly-primary"
                aria-label={t('Password')}
                autoComplete="current-password"
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
                required
              />
            </label>
            <Button className="mt-1 h-11 w-full bg-waffarly-primary text-white hover:bg-waffarly-primary-hover" disabled={busy} type="submit">
              {busy ? t('Signing in…') : t('Sign in')}
            </Button>
          </form>
          {error && <p className="mt-4 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">{errorText(error)}</p>}
          <div className="mt-7 flex items-center gap-2 border-t border-waffarly-border pt-5 text-xs text-waffarly-muted"><span className="size-2 rounded-full bg-waffarly-success" aria-hidden="true" />{t('Secure platform access')}</div>
        </section>
      </main>
    </div>
  );
}
