import { useEffect, useState, type FormEvent } from 'react';
import type { LoginRequest, OwnerProfile } from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';
import { StorefrontSettings } from './StorefrontSettings.js';

export function App() {
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

  if (profile === undefined) return <main className="shell">Loading Merchant Dashboard…</main>;

  if (profile === null)
    return (
      <main className="shell narrow">
        <div className="eyebrow">Waffarly · Merchant</div>
        <h1>Merchant Dashboard</h1>
        <p>Your account opens after Waffarly activates the first month of your subscription.</p>
        <form className="panel form" onSubmit={(event) => void signIn(event)}>
          <label>
            Username
            <input
              autoComplete="username"
              value={login.username}
              onChange={(event) => setLogin({ ...login, username: event.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={login.password}
              onChange={(event) => setLogin({ ...login, password: event.target.value })}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Sign in
          </button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </main>
    );

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Waffarly · Merchant</div>
          <h1>{profile.merchantName}</h1>
          <p>Signed in as {profile.username}</p>
        </div>
        <button className="secondary" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Restaurant account</div>
            <h2>Contact details</h2>
          </div>
          <span className="status-badge">Subscription active</span>
        </div>
        <dl className="profile-grid">
          <div className="profile-item">
            <dt>Restaurant name</dt>
            <dd>{profile.merchantName}</dd>
          </div>
          <div className="profile-item">
            <dt>Restaurant phone</dt>
            <dd>{profile.contactPhone}</dd>
          </div>
          <div className="profile-item">
            <dt>Owner name</dt>
            <dd>{profile.ownerName}</dd>
          </div>
          <div className="profile-item">
            <dt>Owner mobile</dt>
            <dd>{profile.ownerMobile}</dd>
          </div>
        </dl>
      </section>
      <StorefrontSettings profile={profile} />
    </main>
  );
}
