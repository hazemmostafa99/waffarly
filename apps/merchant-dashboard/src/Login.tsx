import { useLocale, Input, Button, PasswordInput, LanguageSwitcher } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LoginRequest, OwnerProfile } from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';

export function Login() {
  const { t, errorText } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? '/';
  const [login, setLogin] = useState<LoginRequest>({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    <main id="main-content" tabIndex={-1} className="shell narrow">
      <LanguageSwitcher />
      <div className="eyebrow">{t('Waffarly · Merchant')}</div>
      <h1>{t('Merchant Dashboard')}</h1>
      <p>{t('Sign in to manage your business account and review your subscription.')}</p>
      <form className="panel form" onSubmit={(event) => void signIn(event)}>
        <label>
          {t('Username')}{' '}
          <Input
            autoComplete="username"
            value={login.username}
            onChange={(event) => setLogin({ ...login, username: event.target.value })}
            required
          />
        </label>
        <label>
          {t('Password')}{' '}
          <PasswordInput
            aria-label={t('Password')}
            autoComplete="current-password"
            value={login.password}
            onChange={(event) => setLogin({ ...login, password: event.target.value })}
            required
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? t('Signing in…') : t('Sign in')}{' '}
        </Button>
      </form>
      {error && (
        <p className="error" role="alert">
          {errorText(error)}
        </p>
      )}
    </main>
  );
}
