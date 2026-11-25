import { useLocale, Input, Button } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LoginRequest, OwnerProfile } from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';
import './login.css';

export function Login() {
  const { t, errorText, locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? '/';
  const [login, setLogin] = useState<LoginRequest>({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    void apiRequest<OwnerProfile>('/auth/owner/me')
      .then(() => navigate(destination, { replace: true }))
      .catch(() => {});
  }, [navigate, destination]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/owner/login', { method: 'POST', body: JSON.stringify(login) });
      navigate(destination, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="merchant-login"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="merchant-login-topbar">
        <div className="merchant-login-brand">{t('Wfarly · Merchant')}</div>
      </div>
      <section className="merchant-login-card" aria-labelledby="merchant-login-title">
        <header className="merchant-login-heading">
          <div className="merchant-login-mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10v10h18V10M2 10l2-7h16l2 7M2 10a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2M9 20v-6h6v6" />
            </svg>
          </div>
          <h1 id="merchant-login-title">{t('Merchant Dashboard')}</h1>
          <p>{t('Sign in to manage your business account and review your subscription.')}</p>
        </header>
        <form
          className="merchant-login-form"
          onSubmit={(event) => void signIn(event)}
          aria-busy={busy}
        >
          <div className="merchant-login-field">
            <label htmlFor="merchant-username">{t('Username')}</label>
            <Input
              id="merchant-username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              dir={locale === 'ar' ? 'rtl' : 'ltr'}
              value={login.username}
              onChange={(event) => setLogin({ ...login, username: event.target.value })}
              required
            />
          </div>
          <div className="merchant-login-field">
            <label htmlFor="merchant-password">{t('Password')}</label>
            <div className="merchant-login-password">
              <Input
                id="merchant-password"
                name="password"
                type={passwordVisible ? 'text' : 'password'}
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
                autoComplete="current-password"
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
                required
              />
              <button
                className="merchant-login-visibility"
                type="button"
                aria-label={t(passwordVisible ? 'Hide password' : 'Show password')}
                aria-pressed={passwordVisible}
                aria-controls="merchant-password"
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {passwordVisible ? (
                    <>
                      <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a19 19 0 0 1-3.2 3.8M6.2 6.2A20 20 0 0 0 2 12s4 7 10 7a11 11 0 0 0 5.8-1.8" />
                    </>
                  ) : (
                    <>
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
          {error && (
            <p className="merchant-login-error" role="alert">
              {errorText(error)}
            </p>
          )}
          <Button className="merchant-login-submit" type="submit" disabled={busy}>
            {busy && <span className="merchant-login-spinner" aria-hidden="true" />}
            {busy ? t('Signing in…') : t('Sign in')}
          </Button>
        </form>
      </section>
    </main>
  );
}
