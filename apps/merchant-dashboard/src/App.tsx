import { useLocale, Input, Button, Card, PasswordInput, LanguageSwitcher } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import {
  BUSINESS_ACTIVITY_LABELS,
  type LoginRequest,
  type OwnerProfile,
} from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';
import { MerchantWorkspace } from './MerchantWorkspace.js';

export function App() {
  const { t, errorText } = useLocale();
  const [profile, setProfile] = useState<OwnerProfile | null | undefined>(undefined);
  const [login, setLogin] = useState<LoginRequest>({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<OwnerProfile>('/auth/owner/me')
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/owner/login', { method: 'POST', body: JSON.stringify(login) });
      setProfile(await apiRequest<OwnerProfile>('/auth/owner/me'));
      setLogin({ username: '', password: '' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await apiRequest('/auth/owner/logout', { method: 'POST' });
      setProfile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign out failed.');
    }
  }

  if (profile === undefined)
    return (
      <main id="main-content" tabIndex={-1} className="shell">
        {t('Loading Merchant Dashboard…')}
      </main>
    );

  if (profile === null)
    return (
      <main id="main-content" tabIndex={-1} className="shell narrow">
        <LanguageSwitcher />
        <div className="eyebrow">{t('Waffarly · Merchant')}</div>
        <h1>{t('Merchant Dashboard')}</h1>
        <p>
          {t('Your account opens after Waffarly activates the first month of your subscription.')}
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

  return (
    <MerchantWorkspace
      profile={profile}
      signOut={() => void signOut()}
      error={
        error ? (
          <p className="error" role="alert">
            {errorText(error)}
          </p>
        ) : null
      }
      account={
        <Card className="panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">{t('Business account')}</div>
              <h2>{t('Contact details')}</h2>
            </div>
            <span className="status-badge">{t('Subscription active')}</span>
          </div>
          <h3 className="merchant-dashboard-account-name">{profile.merchantName}</h3>
          <dl className="profile-grid">
            <div className="profile-item">
              <dt>{t('Business activity')}</dt>
              <dd>{t(BUSINESS_ACTIVITY_LABELS[profile.activity ?? 'other'])}</dd>
            </div>
            <div className="profile-item">
              <dt>{t('Business name')}</dt>
              <dd>{profile.merchantName}</dd>
            </div>
            <div className="profile-item">
              <dt>{t('Business phone')}</dt>
              <dd>{profile.contactPhone}</dd>
            </div>
            <div className="profile-item">
              <dt>{t('Owner name')}</dt>
              <dd>{profile.ownerName}</dd>
            </div>
            <div className="profile-item">
              <dt>{t('Owner mobile')}</dt>
              <dd>{profile.ownerMobile}</dd>
            </div>
          </dl>
        </Card>
      }
    />
  );
}
