import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, Store, XCircle } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge.js';
import './applications.css';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  BUSINESS_ACTIVITY_LABELS,
  type ApproveMerchantApplicationRequest,
  type RejectMerchantApplicationRequest,
  type MerchantApplicationSummary,
  type MerchantSummary,
} from '@waffarly/contracts';
import {
  Button,
  Card,
  Input,
  PasswordInput,
  Textarea,
  useLocale,
  type LocalizedMessage,
} from '@waffarly/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { adminQueryKeys } from '../../app/query-keys.js';
import { apiRequest } from '../../lib/api-client.js';
import { isPendingMerchantApplication, useMerchantApplicationsQuery } from './merchant-queries.js';

const emptyOwnerCredentials: ApproveMerchantApplicationRequest = { username: '', password: '' };
type CredentialsToSend = { username: string; password: string; ownerMobile: string };
function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

export function ApplicationsPage() {
  const { t, formatDate, errorText } = useLocale();
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get('application');
  const query = useMerchantApplicationsQuery();
  const cache = useQueryClient();
  const pendingApplications = (query.data ?? []).filter(isPendingMerchantApplication);
  const visibleApplications = selectedId
    ? pendingApplications.filter((application) => application.id === selectedId)
    : pendingApplications;
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

  async function refreshApplications() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: adminQueryKeys.applications }),
      cache.invalidateQueries({ queryKey: adminQueryKeys.merchants }),
    ]);
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
      await apiRequest<MerchantSummary>(`/admin/merchant-applications/${application.id}/approve`, {
        method: 'POST',
        body: JSON.stringify(ownerCredentials),
      });
      await refreshApplications();
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
      await apiRequest<MerchantApplicationSummary>(
        `/admin/merchant-applications/${application.id}/reject`,
        { method: 'POST', body: JSON.stringify(input) },
      );
      await refreshApplications();
      setApplicationRejectionReasons((current) => ({ ...current, [application.id]: '' }));
      setNotice('Application rejected. The reason has been recorded.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page applications-page">
      <PageHeader
        title={t('Business applications')}
        actions={
          <Button
            asChild
            variant="outline"
            className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input"
          >
            <Link to={selectedId ? '/applications' : '/merchants'}>
              <ArrowLeft size={15} className="rtl:rotate-180" aria-hidden="true" />
              {t(selectedId ? 'Review applications' : 'View businesses')}
            </Link>
          </Button>
        }
      />
      {error && (
        <p className="application-feedback application-feedback-error" role="alert">
          {errorText(error)}
        </p>
      )}
      {notice && (
        <p className="application-feedback application-feedback-success" role="status">
          {t(notice)}
        </p>
      )}
      {query.isPending ? (
        <p role="status">{t('Loading applications')}</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{errorText(query.error.message)}</p>
          <Button onClick={() => void query.refetch()}>{t('Try again')}</Button>
        </div>
      ) : (
        <section className="grid admin-stack min-w-0">
          <Card className="admin-panel-flush application-panel">
            <div className="admin-section application-panel-heading">
              <div className="application-heading-copy">
                <Clock3 size={17} aria-hidden="true" />
                <h2>{t('Applications to review')}</h2>
              </div>
              <StatusBadge tone="warning">{String(visibleApplications.length)}</StatusBadge>
            </div>
            <p className="admin-section application-introduction">
              {t(
                'Review the contact details and complete your checks before approval. An owner account is created only when you approve an application.',
              )}{' '}
            </p>
            {visibleApplications.length === 0 ? (
              <p className="admin-section application-empty">
                <CheckCircle2 size={20} aria-hidden="true" />
                {t('No applications are awaiting review.')}
              </p>
            ) : (
              <div className="grid min-w-0">
                {visibleApplications.map((application) => {
                  const credentials =
                    applicationCredentials[application.id] ?? emptyOwnerCredentials;
                  return (
                    <article className="application application-review-card" key={application.id}>
                      <div className="application-summary admin-section">
                        <div className="application-business-heading">
                          <span className="application-business-icon">
                            <Store size={19} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <h3>
                              <bdi>{application.name}</bdi>
                            </h3>
                            <span className="application-caption">
                              {t(BUSINESS_ACTIVITY_LABELS[application.activity ?? 'other'])}
                            </span>
                          </div>
                          <StatusBadge tone="warning">{t('Awaiting review')}</StatusBadge>
                        </div>
                        <dl className="application-contact-grid">
                          <div>
                            <dt>{t('Business contact:')}</dt>
                            <dd>
                              <bdi dir="ltr">{application.contactPhone}</bdi>
                            </dd>
                          </div>
                          <div>
                            <dt>{t('Owner')}</dt>
                            <dd>
                              <bdi dir="auto">{application.ownerName}</bdi>
                            </dd>
                          </div>
                          <div>
                            <dt>{t('Owner mobile number')}</dt>
                            <dd>
                              <bdi dir="ltr">{application.ownerMobile}</bdi>
                            </dd>
                          </div>
                          <div>
                            <dt>{t('Submitted')}</dt>
                            <dd>
                              <time dateTime={application.createdAt}>
                                {formatDate(application.createdAt, true)}
                              </time>
                            </dd>
                          </div>
                        </dl>
                        {application.priorRejectedApplications?.length > 0 && (
                          <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <summary className="cursor-pointer font-semibold">
                              {t('Previous rejected applications ({{count}})', {
                                count: application.priorRejectedApplications.length,
                              })}
                            </summary>
                            <div className="mt-3 grid gap-3">
                              {application.priorRejectedApplications.map((previous) => (
                                <div className="border-t border-amber-200 pt-3" key={previous.id}>
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
                      <div className="application-decisions">
                        <form
                          className="application-decision admin-section"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void approveApplication(application);
                          }}
                        >
                          <div className="application-form-heading">
                            <ShieldCheck size={16} aria-hidden="true" />
                            <h4>{t('Approve and create owner account')}</h4>
                          </div>
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
                          <Button className="application-approve" disabled={busy} type="submit">
                            <CheckCircle2 size={15} aria-hidden="true" />
                            {t('Approve and create owner account')}{' '}
                          </Button>
                        </form>
                        <form
                          className="application-decision application-rejection admin-section"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void rejectApplication(application);
                          }}
                        >
                          <div className="application-form-heading">
                            <XCircle size={16} aria-hidden="true" />
                            <h4>{t('Reject application permanently')}</h4>
                          </div>
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
                            className="application-reject"
                            disabled={busy}
                            type="submit"
                          >
                            {t('Reject application permanently')}
                          </Button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
          {credentialsToSend && (
            <Card className="admin-panel credential-panel application-credentials">
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
                className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input"
                type="button"
                onClick={() => setCredentialsToSend(null)}
              >
                {t('Done — hide password')}{' '}
              </Button>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
