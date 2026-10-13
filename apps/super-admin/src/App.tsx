import { useEffect, useState, type FormEvent } from 'react';
import type {
  ActivateFirstMonthRequest,
  CreateMerchantRequest,
  LoginRequest,
  MerchantSummary,
} from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';

const emptyMerchant: CreateMerchantRequest = {
  name: '',
  contactPhone: '',
  ownerName: '',
  ownerMobile: '',
  username: '',
  password: '',
};

type CredentialsToSend = { username: string; password: string; ownerMobile: string };

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

export function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [adminName, setAdminName] = useState('');
  const [login, setLogin] = useState<LoginRequest>({ username: '', password: '' });
  const [merchantForm, setMerchantForm] = useState<CreateMerchantRequest>(emptyMerchant);
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [credentialsToSend, setCredentialsToSend] = useState<CredentialsToSend | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void apiRequest<{ username: string }>('/auth/admin/me')
      .then((profile) => {
        setAdminName(profile.username);
        setSignedIn(true);
      })
      .catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void apiRequest<MerchantSummary[]>('/admin/merchants')
      .then(setMerchants)
      .catch((cause: unknown) => setError(errorMessage(cause)));
  }, [signedIn]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/admin/login', { method: 'POST', body: JSON.stringify(login) });
      setAdminName(login.username);
      setLogin({ username: '', password: '' });
      setSignedIn(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await apiRequest('/auth/admin/logout', { method: 'POST' });
      setSignedIn(false);
      setMerchants([]);
      setCredentialsToSend(null);
      setError('');
      setNotice('');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function createMerchant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await apiRequest<MerchantSummary>('/admin/merchants', {
        method: 'POST',
        body: JSON.stringify(merchantForm),
      });
      setMerchants((current) => [created, ...current]);
      setCredentialsToSend({
        username: merchantForm.username,
        password: merchantForm.password,
        ownerMobile: merchantForm.ownerMobile,
      });
      setMerchantForm(emptyMerchant);
      setNotice('Merchant created and approved. Subscription is not active yet.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function activate(merchant: MerchantSummary) {
    if (
      !window.confirm(
        `Confirm that the first month was collected outside Waffarly for ${merchant.name}?`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body: ActivateFirstMonthRequest = { externalCollectionConfirmed: true };
      const updated = await apiRequest<MerchantSummary>(
        `/admin/merchants/${merchant.id}/activate-first-month`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      setMerchants((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(`First month activated for ${updated.name}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (signedIn === null) return <main className="shell">Loading Super Admin…</main>;

  if (!signedIn)
    return (
      <main className="shell narrow">
        <div className="eyebrow">Waffarly · Platform</div>
        <h1>Super Admin</h1>
        <p>Sign in to create restaurants and activate their first month.</p>
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
          <button disabled={busy} type="submit">
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
          <div className="eyebrow">Waffarly · Platform</div>
          <h1>Restaurants</h1>
          <p>Signed in as {adminName}</p>
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
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="columns">
        <section className="panel">
          <h2>Create a restaurant</h2>
          <p>Creation approves the restaurant. Access starts after first-month activation.</p>
          <form className="form" onSubmit={(event) => void createMerchant(event)}>
            {(
              [
                ['name', 'Restaurant name'],
                ['contactPhone', 'Restaurant contact number'],
                ['ownerName', 'Owner name'],
                ['ownerMobile', 'Owner mobile number'],
                ['username', 'Owner username'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={merchantForm[key]}
                  onChange={(event) =>
                    setMerchantForm({ ...merchantForm, [key]: event.target.value })
                  }
                  required
                />
              </label>
            ))}
            <label>
              Owner password <small>(at least 12 characters)</small>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                value={merchantForm.password}
                onChange={(event) =>
                  setMerchantForm({ ...merchantForm, password: event.target.value })
                }
                required
              />
            </label>
            <button disabled={busy} type="submit">
              Create restaurant
            </button>
          </form>
        </section>
        <section>
          {credentialsToSend && (
            <div className="panel credential-panel">
              <h2>Send credentials manually</h2>
              <p>
                Verify the owner by phone, then send these details privately to{' '}
                <strong>{credentialsToSend.ownerMobile}</strong>. The password is shown here only
                until this panel is dismissed.
              </p>
              <p>
                Username: <strong>{credentialsToSend.username}</strong>
              </p>
              <p>
                Password: <strong>{credentialsToSend.password}</strong>
              </p>
              <button
                className="secondary"
                type="button"
                onClick={() => setCredentialsToSend(null)}
              >
                Done — hide password
              </button>
            </div>
          )}
          <div className="panel">
            <h2>Merchants</h2>
            {merchants.length === 0 && <p>No restaurants have been created yet.</p>}
            <div className="merchant-list">
              {merchants.map((merchant) => (
                <article className="merchant" key={merchant.id}>
                  <div>
                    <h3>{merchant.name}</h3>
                    <p>
                      {merchant.ownerName} · {merchant.ownerMobile}
                    </p>
                    <p>Owner username: {merchant.username}</p>
                    <p>
                      {merchant.firstMonthActivatedAt
                        ? `First month activated ${new Date(merchant.firstMonthActivatedAt).toLocaleDateString()}`
                        : 'Awaiting first-month activation'}
                    </p>
                  </div>
                  {!merchant.firstMonthActivatedAt && (
                    <button disabled={busy} type="button" onClick={() => void activate(merchant)}>
                      Activate first month
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
