import { useLocale, Input, Button, PasswordInput } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from './lib/api-client.js';

export function Login() {
  const { t, errorText } = useLocale();
  const navigate = useNavigate();
  const [login, setLogin] = useState({ storefrontSlug: '', username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest('/auth/pos/me')
      .then(() => navigate('/'))
      .catch(() => {});
  }, [navigate]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/pos/login', { method: 'POST', body: JSON.stringify(login) });
      navigate('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="shell narrow">
      <div className="eyebrow">{t('Waffarly · POS')}</div>
      <h1>{t('Point of Sale')}</h1>
      <p>{t('Sign in with your business code and employee account.')}</p>
      <form className="panel form" onSubmit={(event) => void signIn(event)}>
        <label>
          {t('Business code')}{' '}
          <Input
            autoComplete="organization"
            value={login.storefrontSlug}
            onChange={(event) => setLogin({ ...login, storefrontSlug: event.target.value })}
            required
          />
        </label>
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
