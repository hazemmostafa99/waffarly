import { useEffect, useState, type FormEvent } from 'react';
import type {
  ApproveMerchantApplicationRequest,
  ActivateFirstMonthRequest,
  CreateMerchantRequest,
  LoginRequest,
  MerchantApplicationSummary,
  MerchantSummary,
} from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';
import { Templates } from './Templates.js';
import { Plans } from './Plans.js';
import { ActivitiesModules } from './ActivitiesModules.js';

const emptyMerchant: CreateMerchantRequest = {
  name: '',
  contactPhone: '',
  ownerName: '',
  ownerMobile: '',
  username: '',
  password: '',
};

const emptyOwnerCredentials: ApproveMerchantApplicationRequest = { username: '', password: '' };

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
  const [applications, setApplications] = useState<MerchantApplicationSummary[]>([]);
  const [applicationCredentials, setApplicationCredentials] = useState<
    Record<string, ApproveMerchantApplicationRequest>
  >({});
  const [credentialsToSend, setCredentialsToSend] = useState<CredentialsToSend | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState<
    'restaurants' | 'templates' | 'plans' | 'activities'
  >('restaurants');

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
    void Promise.all([
      apiRequest<MerchantSummary[]>('/admin/merchants'),
      apiRequest<MerchantApplicationSummary[]>('/admin/merchant-applications'),
    ])
      .then(([merchantRows, applicationRows]) => {
        setMerchants(merchantRows);
        setApplications(applicationRows);
      })
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
      setApplications([]);
      setApplicationCredentials({});
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

  function setApplicationCredential(
    applicationId: string,
    key: keyof ApproveMerchantApplicationRequest,
    value: string,
  ) {
    setApplicationCredentials((current) => ({
      ...current,
      [applicationId]: {
        ...(current[applicationId] ?? emptyOwnerCredentials),
        [key]: value,
      },
    }));
  }

  async function approveApplication(application: MerchantApplicationSummary) {
    const ownerCredentials = applicationCredentials[application.id] ?? emptyOwnerCredentials;
    if (!window.confirm(`Approve ${application.name} and create its owner account?`)) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await apiRequest<MerchantSummary>(
        `/admin/merchant-applications/${application.id}/approve`,
        { method: 'POST', body: JSON.stringify(ownerCredentials) },
      );
      setMerchants((current) => [created, ...current]);
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setCredentialsToSend({
        username: ownerCredentials.username.trim().toLowerCase(),
        password: ownerCredentials.password,
        ownerMobile: application.ownerMobile,
      });
      setApplicationCredentials((current) => ({
        ...current,
        [application.id]: emptyOwnerCredentials,
      }));
      setNotice(
        'Application approved. The restaurant and owner account are created. Subscription access is still inactive.',
      );
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
        <p>Sign in to review applications, create restaurants, and activate their first month.</p>
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
          <h1>{activeSection === 'templates' ? 'Templates & Design Library' : 'Restaurants'}</h1>
          <p>Signed in as {adminName}</p>
        </div>
        <button className="secondary" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <nav className="admin-nav" aria-label="Platform administration">
        <button
          className={activeSection === 'restaurants' ? 'admin-nav-active' : ''}
          aria-current={activeSection === 'restaurants' ? 'page' : undefined}
          type="button"
          onClick={() => {
            setActiveSection('restaurants');
            setError('');
            setNotice('');
          }}
        >
          Restaurants <span>Onboarding</span>
        </button>
        <button
          className={activeSection === 'templates' ? 'admin-nav-active' : ''}
          aria-current={activeSection === 'templates' ? 'page' : undefined}
          type="button"
          onClick={() => {
            setActiveSection('templates');
            setError('');
            setNotice('');
          }}
        >
          Design library <span>Storefronts</span>
        </button>
        <button
          className={activeSection === 'plans' ? 'admin-nav-active' : ''}
          aria-current={activeSection === 'plans' ? 'page' : undefined}
          type="button"
          onClick={() => {
            setActiveSection('plans');
            setError('');
            setNotice('');
          }}
        >
          Plans <span>Monthly offers</span>
        </button>
        <button
          className={activeSection === 'activities' ? 'admin-nav-active' : ''}
          aria-current={activeSection === 'activities' ? 'page' : undefined}
          type="button"
          onClick={() => {
            setActiveSection('activities');
            setError('');
            setNotice('');
          }}
        >
          Activities & modules <span>Capabilities</span>
        </button>
      </nav>
      {activeSection === 'restaurants' && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {activeSection === 'restaurants' && notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {activeSection === 'activities' ? (
        <ActivitiesModules />
      ) : activeSection === 'plans' ? (
        <Plans />
      ) : activeSection === 'templates' ? (
        <Templates />
      ) : (
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
            <div className="panel">
              <h2>Restaurant applications</h2>
              <p>
                Review the contact details and complete your checks before approval. An owner
                account is created only when you approve an application.
              </p>
              {applications.filter((application) => !application.approvedAt).length === 0 ? (
                <p>No applications are awaiting review.</p>
              ) : (
                <div className="merchant-list">
                  {applications
                    .filter((application) => !application.approvedAt)
                    .map((application) => {
                      const credentials =
                        applicationCredentials[application.id] ?? emptyOwnerCredentials;
                      return (
                        <article className="merchant application" key={application.id}>
                          <div>
                            <h3>{application.name}</h3>
                            <p>Restaurant contact: {application.contactPhone}</p>
                            <p>
                              {application.ownerName} · {application.ownerMobile}
                            </p>
                            <p>Submitted {new Date(application.createdAt).toLocaleString()}</p>
                          </div>
                          <form
                            className="approval-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void approveApplication(application);
                            }}
                          >
                            <label>
                              Owner username
                              <input
                                autoComplete="username"
                                minLength={3}
                                maxLength={80}
                                pattern="[A-Za-z0-9._-]+"
                                required
                                value={credentials.username}
                                onChange={(event) =>
                                  setApplicationCredential(
                                    application.id,
                                    'username',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              Owner password <small>(12–128 characters)</small>
                              <input
                                autoComplete="new-password"
                                type="password"
                                minLength={12}
                                maxLength={128}
                                required
                                value={credentials.password}
                                onChange={(event) =>
                                  setApplicationCredential(
                                    application.id,
                                    'password',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <button disabled={busy} type="submit">
                              Approve and create owner account
                            </button>
                          </form>
                        </article>
                      );
                    })}
                </div>
              )}
            </div>
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
      )}
    </main>
  );
}
