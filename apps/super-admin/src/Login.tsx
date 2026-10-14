import { useLocale, Input, Button, PasswordInput } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LoginRequest } from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

export function Login() {
  const { t, errorText } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string } | null)?.from ?? '/';
  const [login, setLogin] = useState<LoginRequest>({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<{ username: string }>('/auth/admin/me')
      .then(() => navigate(destination, { replace: true }))
      .catch(() => {});
  }, [navigate, destination]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/admin/login', { method: 'POST', body: JSON.stringify(login) });
      navigate(destination, { replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="shell narrow">
      <div className="eyebrow">{t('Waffarly · Platform')}</div>
      <h1>{t('Super Admin')}</h1>
      <p>
        {t('Sign in to review applications, create businesses, and activate their first month.')}
      </p>
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
        <Button disabled={busy} type="submit">
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
