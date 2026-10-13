import {
  BUSINESS_ACTIVITY_KEYS,
  BUSINESS_ACTIVITY_LABELS,
  type BusinessActivityKey,
} from '@waffarly/contracts';
import type { LocalizedMessage } from '@waffarly/ui';
import { useLocale, Input, Button, Card, PasswordInput, Textarea } from '@waffarly/ui';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  ApproveMerchantApplicationRequest,
  ActivateFirstMonthRequest,
  CreateMerchantRequest,
  LoginRequest,
  MerchantApplicationSummary,
  MerchantSummary,
  RejectMerchantApplicationRequest,
} from '@waffarly/contracts';
import { apiRequest } from './lib/api-client.js';
import { Templates } from './Templates.js';
import { Plans } from './Plans.js';
import { ActivitiesModules } from './ActivitiesModules.js';

const emptyMerchant: CreateMerchantRequest = {
  name: '',
  activity: 'other',
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
  const { t, formatDate, errorText } = useLocale();
  const [businessQuery, setBusinessQuery] = useState('');
  const [loadingMerchants, setLoadingMerchants] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [adminName, setAdminName] = useState('');
  const [login, setLogin] = useState<LoginRequest>({ username: '', password: '' });
  const [merchantForm, setMerchantForm] = useState<CreateMerchantRequest>(emptyMerchant);
  const [merchants, setMerchants] = useState<MerchantSummary[]>([]);
  const [applications, setApplications] = useState<MerchantApplicationSummary[]>([]);
  const [applicationCredentials, setApplicationCredentials] = useState<
    Record<string, ApproveMerchantApplicationRequest>
  >({});
  const [applicationRejectionReasons, setApplicationRejectionReasons] = useState<
    Record<string, string>
  >({});
  const [credentialsToSend, setCredentialsToSend] = useState<CredentialsToSend | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const [activeSection, setActiveSection] = useState<
    'businesses' | 'templates' | 'plans' | 'activities'
  >('businesses');

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
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setLoadingMerchants(false));
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
      setApplicationRejectionReasons({});
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
        t('Confirm that the first month was collected outside Waffarly for {{name}}?', {
          name: merchant.name,
        }),
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
      setNotice({ key: 'First month activated for {{name}}.', values: { name: updated.name } });
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
    if (
      !window.confirm(
        t('Approve {{name}} and create its owner account?', { name: application.name }),
      )
    )
      return;

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
      setApplicationRejectionReasons((current) => ({ ...current, [application.id]: '' }));
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
        'Application approved. The business and owner account are created. Subscription access is still inactive.',
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function rejectApplication(application: MerchantApplicationSummary) {
    const reason = applicationRejectionReasons[application.id] ?? '';
    if (!reason.trim()) return;
    if (!window.confirm(t('Reject {{name}} permanently?', { name: application.name }))) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const input: RejectMerchantApplicationRequest = { reason };
      const rejected = await apiRequest<MerchantApplicationSummary>(
        `/admin/merchant-applications/${application.id}/reject`,
        { method: 'POST', body: JSON.stringify(input) },
      );
      setApplications((current) =>
        current.map((item) => (item.id === rejected.id ? rejected : item)),
      );
      setApplicationRejectionReasons((current) => ({ ...current, [application.id]: '' }));
      setNotice('Application rejected. The reason has been recorded.');
      void apiRequest<MerchantApplicationSummary[]>('/admin/merchant-applications')
        .then(setApplications)
        .catch((cause: unknown) => setError(errorMessage(cause)));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (signedIn === null)
    return (
      <main id="main-content" tabIndex={-1} className="shell">
        {t('Loading Super Admin…')}
      </main>
    );

  if (!signedIn)
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

  return (
    <main id="main-content" tabIndex={-1} className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">{t('Waffarly · Platform')}</div>
          <h1>
            {t(
              {
                businesses: 'Businesses',
                templates: 'Templates & Design Library',
                plans: 'Monthly plans',
                activities: 'Activities & modules',
              }[activeSection],
            )}
          </h1>
          <p>
            {t('Signed in as')} {adminName}
          </p>
        </div>
        <Button
          variant="outline"
          className="secondary"
          type="button"
          onClick={() => void signOut()}
        >
          {t('Sign out')}{' '}
        </Button>
      </header>
      <nav className="admin-nav" aria-label={t('Platform administration')}>
        <Button
          variant="ghost"
          className={activeSection === 'businesses' ? 'admin-nav-active' : ''}
          aria-current={activeSection === 'businesses' ? 'page' : undefined}
          type="button"
          onClick={() => {
            setActiveSection('businesses');
            setError('');
            setNotice('');
          }}
        >
          {t('Businesses')} <span>{t('Onboarding')}</span>
        </Button>
        <Button
          variant="ghost"
          className={activeSection === 'templates' ? 'admin-nav-active' : ''}
          aria-current={activeSection === 'templates' ? 'page' : undefined}
          type="button"
          onClick={() => {
            setActiveSection('templates');
            setError('');
            setNotice('');
          }}
        >
          {t('Design library')} <span>{t('Storefronts')}</span>
        </Button>
        <Button
          variant="ghost"
          className={activeSection === 'plans' ? 'admin-nav-active' : ''}
          aria-current={activeSection === 'plans' ? 'page' : undefined}
          type="button"
          onClick={() => {
            setActiveSection('plans');
            setError('');
            setNotice('');
          }}
        >
          {t('Plans')} <span>{t('Monthly offers')}</span>
        </Button>
        <Button
          variant="ghost"
          className={activeSection === 'activities' ? 'admin-nav-active' : ''}
          aria-current={activeSection === 'activities' ? 'page' : undefined}
          type="button"
          onClick={() => {
            setActiveSection('activities');
            setError('');
            setNotice('');
          }}
        >
          {t('Activities & modules')} <span>{t('Capabilities')}</span>
        </Button>
      </nav>
      {activeSection === 'businesses' && (
        <section className="mb-6 grid gap-4 sm:grid-cols-3" aria-label={t('Business overview')}>
          {[
            ['Businesses', merchants.length],
            [
              'Awaiting review',
              applications.filter((item) => !item.approvedAt && !item.rejectedAt).length,
            ],
            ['Active subscriptions', merchants.filter((item) => item.firstMonthActivatedAt).length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-card p-5">
              <p className="m-0 text-sm">{t(String(label))}</p>
              <strong className="mt-2 block text-3xl">{loadingMerchants ? '—' : value}</strong>
            </div>
          ))}
        </section>
      )}
      {activeSection === 'businesses' && error && (
        <p className="error" role="alert">
          {errorText(error)}
        </p>
      )}
      {activeSection === 'businesses' && notice && (
        <p className="notice" role="status">
          {t(notice)}
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
          <Card className="panel">
            <h2>{t('Create a business')}</h2>
            <p>
              {t('Creation approves the business. Access starts after first-month activation.')}
            </p>
            <form className="form" onSubmit={(event) => void createMerchant(event)}>
              <label>
                {t('Business activity')}
                <select
                  aria-label={t('Business activity')}
                  value={merchantForm.activity ?? 'other'}
                  onChange={(event) =>
                    setMerchantForm({
                      ...merchantForm,
                      activity: event.target.value as BusinessActivityKey,
                    })
                  }
                >
                  {BUSINESS_ACTIVITY_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {t(BUSINESS_ACTIVITY_LABELS[key])}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  ['name', t('Business name')],
                  ['contactPhone', t('Business contact number')],
                  ['ownerName', t('Owner name')],
                  ['ownerMobile', t('Owner mobile number')],
                  ['username', t('Owner username')],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {t(label)}
                  <Input
                    value={merchantForm[key]}
                    onChange={(event) =>
                      setMerchantForm({ ...merchantForm, [key]: event.target.value })
                    }
                    required
                  />
                </label>
              ))}
              <label>
                {t('Owner password')} <small>{t('(at least 12 characters)')}</small>
                <PasswordInput
                  aria-label={t('Owner password')}
                  autoComplete="new-password"
                  minLength={12}
                  value={merchantForm.password}
                  onChange={(event) =>
                    setMerchantForm({ ...merchantForm, password: event.target.value })
                  }
                  required
                />
              </label>
              <Button disabled={busy} type="submit">
                {t('Create business')}{' '}
              </Button>
            </form>
          </Card>
          <section>
            <Card className="panel">
              <h2>{t('Business applications')}</h2>
              <p>
                {t(
                  'Review the contact details and complete your checks before approval. An owner account is created only when you approve an application.',
                )}{' '}
              </p>
              {applications.filter(
                (application) => !application.approvedAt && !application.rejectedAt,
              ).length === 0 ? (
                <p>{t('No applications are awaiting review.')}</p>
              ) : (
                <div className="merchant-list">
                  {applications
                    .filter((application) => !application.approvedAt && !application.rejectedAt)
                    .map((application) => {
                      const credentials =
                        applicationCredentials[application.id] ?? emptyOwnerCredentials;
                      return (
                        <article
                          className="merchant application application-review"
                          key={application.id}
                        >
                          <div>
                            <h3>{application.name}</h3>
                            <p>{t(BUSINESS_ACTIVITY_LABELS[application.activity ?? 'other'])}</p>
                            <p>
                              {t('Business contact:')} {application.contactPhone}
                            </p>
                            <p>
                              {application.ownerName} · {application.ownerMobile}
                            </p>
                            <p>
                              {t('Submitted')} {formatDate(application.createdAt, true)}
                            </p>
                            {application.priorRejectedApplications.length > 0 && (
                              <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <summary className="cursor-pointer font-semibold">
                                  {t('Previous rejected applications ({{count}})', {
                                    count: application.priorRejectedApplications.length,
                                  })}
                                </summary>
                                <div className="mt-3 grid gap-3">
                                  {application.priorRejectedApplications.map((previous) => (
                                    <div
                                      className="border-t border-amber-200 pt-3"
                                      key={previous.id}
                                    >
                                      <p>
                                        <strong>{previous.name}</strong>
                                      </p>
                                      <p>
                                        {t('Business contact:')} {previous.contactPhone}
                                      </p>
                                      <p>
                                        {previous.ownerName} · {previous.ownerMobile}
                                      </p>
                                      <p>
                                        {t('Submitted')} {formatDate(previous.createdAt, true)}
                                      </p>
                                      <p>
                                        {t('Rejected')} {formatDate(previous.rejectedAt, true)}
                                      </p>
                                      <p>
                                        {t('Rejected by:')} {previous.rejectedBy}
                                      </p>
                                      <p>
                                        <strong>{t('Rejection reason:')}</strong>{' '}
                                        {previous.rejectionReason}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                          <form
                            className="approval-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void approveApplication(application);
                            }}
                          >
                            <label>
                              {t('Owner username')}{' '}
                              <Input
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
                              {t('Owner password')} <small>{t('(12–128 characters)')}</small>
                              <PasswordInput
                                aria-label={t('Owner password')}
                                autoComplete="new-password"
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
                            <Button disabled={busy} type="submit">
                              {t('Approve and create owner account')}{' '}
                            </Button>
                          </form>
                          <form
                            className="approval-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void rejectApplication(application);
                            }}
                          >
                            <label>
                              {t('Rejection reason')} <small>{t('Required')}</small>
                              <Textarea
                                rows={4}
                                required
                                value={applicationRejectionReasons[application.id] ?? ''}
                                onChange={(event) =>
                                  setApplicationRejectionReasons((current) => ({
                                    ...current,
                                    [application.id]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            <Button
                              variant="outline"
                              className="secondary"
                              disabled={busy}
                              type="submit"
                            >
                              {t('Reject application permanently')}
                            </Button>
                          </form>
                        </article>
                      );
                    })}
                </div>
              )}
            </Card>
            {credentialsToSend && (
              <Card className="panel credential-panel">
                <h2>{t('Send credentials manually')}</h2>
                <p>
                  {t('Verify the owner by phone, then send these details privately to')}{' '}
                  <strong>{credentialsToSend.ownerMobile}</strong>
                  {t('. The password is shown here only until this panel is dismissed.')}{' '}
                </p>
                <p>
                  {t('Username:')} <strong>{credentialsToSend.username}</strong>
                </p>
                <p>
                  {t('Password:')} <strong>{credentialsToSend.password}</strong>
                </p>
                <Button
                  variant="outline"
                  className="secondary"
                  type="button"
                  onClick={() => setCredentialsToSend(null)}
                >
                  {t('Done — hide password')}{' '}
                </Button>
              </Card>
            )}
            <Card className="panel">
              <h2>{t('Merchants')}</h2>
              <label className="mb-4">
                {t('Search businesses')}
                <Input
                  type="search"
                  placeholder={t('Search by business, owner, or phone')}
                  value={businessQuery}
                  onChange={(event) => setBusinessQuery(event.target.value)}
                />
              </label>
              {loadingMerchants ? (
                <p role="status">{t('Loading…')}</p>
              ) : (
                merchants.length === 0 && <p>{t('No businesses have been created yet.')}</p>
              )}
              {merchants.length > 0 &&
                !merchants.some((merchant) =>
                  `${merchant.name} ${merchant.ownerName} ${merchant.ownerMobile}`
                    .toLowerCase()
                    .includes(businessQuery.trim().toLowerCase()),
                ) && <p>{t('No businesses match your search.')}</p>}
              <div className="merchant-list">
                {merchants
                  .filter((merchant) =>
                    `${merchant.name} ${merchant.ownerName} ${merchant.ownerMobile}`
                      .toLowerCase()
                      .includes(businessQuery.trim().toLowerCase()),
                  )
                  .map((merchant) => (
                    <article className="merchant" key={merchant.id}>
                      <div>
                        <h3>{merchant.name}</h3>
                        <p>
                          {merchant.ownerName} · {merchant.ownerMobile}
                        </p>
                        <p>
                          {t('Owner username:')} {merchant.username}
                        </p>
                        <p>
                          {merchant.firstMonthActivatedAt
                            ? t('First month activated {{date}}', {
                                date: formatDate(merchant.firstMonthActivatedAt),
                              })
                            : t('Awaiting first-month activation')}
                        </p>
                      </div>
                      {!merchant.firstMonthActivatedAt && (
                        <Button
                          disabled={busy}
                          type="button"
                          onClick={() => void activate(merchant)}
                        >
                          {t('Activate first month')}{' '}
                        </Button>
                      )}
                    </article>
                  ))}
              </div>
            </Card>
          </section>
        </div>
      )}
    </main>
  );
}
