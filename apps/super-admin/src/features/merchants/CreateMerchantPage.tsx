import { useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, Store } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BUSINESS_ACTIVITY_KEYS,
  BUSINESS_ACTIVITY_LABELS,
  type BusinessActivityKey,
  type CreateMerchantRequest,
  type MerchantSummary,
} from '@waffarly/contracts';
import { Button, Card, Input, PasswordInput, useLocale } from '@waffarly/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { adminQueryKeys } from '../../app/query-keys.js';
import { apiRequest } from '../../lib/api-client.js';

const emptyMerchant: CreateMerchantRequest = {
  name: '',
  activity: 'other',
  contactPhone: '',
  ownerName: '',
  ownerMobile: '',
  username: '',
  password: '',
};

type CreatedCredentials = {
  merchantName: string;
  ownerMobile: string;
  username: string;
  password: string;
};

function FormField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-xs font-semibold text-waffarly-ink" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="m-0 text-[11px] leading-5 text-waffarly-muted" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

export function CreateMerchantPage() {
  const { t, errorText } = useLocale();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateMerchantRequest>(emptyMerchant);
  const [formError, setFormError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const pendingRequest = useRef<CreateMerchantRequest | null>(null);

  const createMerchant = useMutation({
    mutationFn: () => {
      const request = pendingRequest.current;
      if (!request) throw new Error('Please check the entered details and try again.');
      return apiRequest<MerchantSummary>('/admin/merchants', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },
    onSuccess: (merchant) => {
      const request = pendingRequest.current;
      if (!request) return;
      setCreatedCredentials({
        merchantName: merchant.name,
        ownerMobile: merchant.ownerMobile,
        username: merchant.username,
        password: request.password,
      });
      pendingRequest.current = null;
      setForm(emptyMerchant);
      setFormError('');
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.merchants });
    },
    onError: (cause: unknown) => {
      pendingRequest.current = null;
      setForm((current) => ({ ...current, password: '' }));
      setFormError(errorText(cause instanceof Error ? cause.message : 'Something went wrong.'));
    },
  });

  function updateForm<K extends keyof CreateMerchantRequest>(key: K, value: CreateMerchantRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (formError) setFormError('');
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Merchant management')}
        title={t('Create a business')}
        description={t('Add a business and its owner account using the approved merchant setup details.')}
        actions={
          <Button asChild variant="outline" className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input">
            <Link to="/merchants">
              <ArrowLeft size={16} aria-hidden="true" />
              {t('Back to businesses')}
            </Link>
          </Button>
        }
      />

      {createdCredentials && (
        <Card className="grid gap-4 border-waffarly-primary/20 bg-waffarly-kpi-mint p-4 text-waffarly-ink md:p-5" role="region" aria-labelledby="merchant-created-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-waffarly-primary">
                <CheckCircle2 size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="m-0 text-sm font-bold" id="merchant-created-heading" role="status" aria-live="polite">{t('Merchant created and approved. Subscription is not active yet.')}</h2>
                <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">
                  {t('Verify the owner by phone, then send these details privately to')}{' '}
                  <bdi dir="ltr" className="font-semibold text-waffarly-ink">{createdCredentials.ownerMobile}</bdi>
                  {t('. The password is shown here only until this panel is dismissed.')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="border-waffarly-border bg-white text-waffarly-primary hover:bg-white/80 hover:text-waffarly-primary"
              onClick={() => setCreatedCredentials(null)}
            >
              {t('Done — hide password')}
            </Button>
          </div>
          <div className="grid gap-3 rounded-xl border border-waffarly-primary/10 bg-white p-3 sm:grid-cols-3">
            <CredentialValue label={t('Business name')} value={createdCredentials.merchantName} />
            <CredentialValue label={t('Username:')} value={createdCredentials.username} />
            <CredentialValue label={t('Password:')} value={createdCredentials.password} sensitive />
          </div>
        </Card>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0 overflow-hidden rounded-2xl border-waffarly-border bg-waffarly-surface p-0 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)]">
          <div className="border-b border-waffarly-border px-4 py-4 md:px-6 md:py-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary">
                <Store size={19} aria-hidden="true" />
              </span>
              <div>
                <h2 className="m-0 text-sm font-bold">{t('Business details')}</h2>
                <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Enter the business contact information and activity.')}</p>
              </div>
            </div>
          </div>

          {formError && (
            <div className="mx-4 mt-4 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger md:mx-6" role="alert" aria-live="assertive">
              <strong className="block">{t('The business could not be created.')}</strong>
              <p className="mb-0 mt-1 text-xs leading-5">{formError}</p>
            </div>
          )}

          <form
            className="grid gap-0"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError('');
              pendingRequest.current = { ...form };
              createMerchant.mutate();
            }}
          >
            <section className="grid gap-4 p-4 md:grid-cols-2 md:p-6" aria-labelledby="business-details-heading">
              <h3 className="sr-only" id="business-details-heading">{t('Business details')}</h3>
              <FormField id="business-name" label={t('Business name')}>
                <Input
                  autoComplete="organization"
                  id="business-name"
                  maxLength={160}
                  required
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  className="h-10 rounded-xl border-waffarly-border bg-white text-sm text-waffarly-ink invalid:border-waffarly-danger"
                />
              </FormField>
              <FormField id="business-activity" label={t('Business activity')}>
                <select
                  id="business-activity"
                  value={form.activity ?? 'other'}
                  onChange={(event) => updateForm('activity', event.target.value as BusinessActivityKey)}
                  className="h-10 min-w-0 rounded-xl border border-waffarly-border bg-white px-3 text-sm font-medium text-waffarly-ink outline-none focus-visible:ring-2 focus-visible:ring-waffarly-primary"
                >
                  {BUSINESS_ACTIVITY_KEYS.map((activity) => (
                    <option key={activity} value={activity}>{t(BUSINESS_ACTIVITY_LABELS[activity])}</option>
                  ))}
                </select>
              </FormField>
              <FormField id="business-contact" label={t('Business contact number')} hint={t('Enter 3–32 characters.')}>
                <Input
                  autoComplete="tel"
                  aria-describedby="business-contact-hint"
                  id="business-contact"
                  type="tel"
                  minLength={3}
                  maxLength={32}
                  required
                  value={form.contactPhone}
                  onChange={(event) => updateForm('contactPhone', event.target.value)}
                  className="h-10 rounded-xl border-waffarly-border bg-white text-sm text-waffarly-ink invalid:border-waffarly-danger"
                  dir="ltr"
                />
              </FormField>
            </section>

            <section className="grid gap-4 border-t border-waffarly-border p-4 md:grid-cols-2 md:p-6" aria-labelledby="owner-account-heading">
              <div className="flex items-start gap-3 md:col-span-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-blue">
                  <ShieldCheck size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="m-0 text-sm font-bold" id="owner-account-heading">{t('Owner account')}</h3>
                  <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Create the owner login. Keep the password private and share it only after verifying the owner.')}</p>
                </div>
              </div>
              <FormField id="owner-name" label={t('Owner name')}>
                <Input
                  autoComplete="name"
                  id="owner-name"
                  maxLength={160}
                  required
                  value={form.ownerName}
                  onChange={(event) => updateForm('ownerName', event.target.value)}
                  className="h-10 rounded-xl border-waffarly-border bg-white text-sm text-waffarly-ink invalid:border-waffarly-danger"
                />
              </FormField>
              <FormField id="owner-mobile" label={t('Owner mobile number')} hint={t('Enter 3–32 characters.')}>
                <Input
                  autoComplete="tel"
                  aria-describedby="owner-mobile-hint"
                  id="owner-mobile"
                  type="tel"
                  minLength={3}
                  maxLength={32}
                  required
                  value={form.ownerMobile}
                  onChange={(event) => updateForm('ownerMobile', event.target.value)}
                  className="h-10 rounded-xl border-waffarly-border bg-white text-sm text-waffarly-ink invalid:border-waffarly-danger"
                  dir="ltr"
                />
              </FormField>
              <FormField id="owner-username" label={t('Owner username')} hint={t('Use 3–80 letters, numbers, dots, underscores, or hyphens.')}>
                <Input
                  autoCapitalize="none"
                  aria-describedby="owner-username-hint"
                  autoComplete="username"
                  id="owner-username"
                  maxLength={80}
                  minLength={3}
                  pattern="[A-Za-z0-9._-]+"
                  required
                  spellCheck={false}
                  value={form.username}
                  onChange={(event) => updateForm('username', event.target.value)}
                  className="h-10 rounded-xl border-waffarly-border bg-white text-sm text-waffarly-ink invalid:border-waffarly-danger"
                  dir="ltr"
                />
              </FormField>
              <FormField id="owner-password" label={t('Owner password')} hint={t('Use a password with 12–128 characters.')}>
                <PasswordInput
                  aria-describedby="owner-password-hint"
                  autoComplete="new-password"
                  id="owner-password"
                  maxLength={128}
                  minLength={12}
                  required
                  value={form.password}
                  onChange={(event) => updateForm('password', event.target.value)}
                  className="h-10 rounded-xl border-waffarly-border bg-white text-sm text-waffarly-ink invalid:border-waffarly-danger"
                  dir="ltr"
                />
              </FormField>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-waffarly-border bg-waffarly-input/50 px-4 py-4 md:px-6">
              <p className="m-0 max-w-xl text-xs leading-5 text-waffarly-muted">{t('Creation approves the business. Access starts after first-month activation.')}</p>
              <Button
                type="submit"
                disabled={createMerchant.isPending}
                className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover"
              >
                {createMerchant.isPending ? t('Creating business…') : t('Create business')}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="grid gap-4 rounded-2xl border-waffarly-border bg-waffarly-surface p-4 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)] md:p-5">
          <div>
            <h2 className="m-0 text-sm font-bold">{t('Approval and access')}</h2>
            <p className="mb-0 mt-1 text-xs leading-5 text-waffarly-muted">{t('Creation approves the business. Access starts after first-month activation.')}</p>
          </div>
          <div className="grid gap-3">
            <RuleStep number="1" title={t('Create the business and owner account')} description={t('The merchant is approved when this form is submitted successfully.')} />
            <RuleStep number="2" title={t('Verify the owner by phone')} description={t('Confirm the owner’s identity before sharing account details.')} />
            <RuleStep number="3" title={t('Record activation separately')} description={t('Only activate after the first month was collected outside Waffarly.')} />
          </div>
          <Link className="text-xs font-semibold text-waffarly-primary underline-offset-4 hover:underline" to="/merchants">
            {t('View registered businesses')}
          </Link>
        </Card>
      </div>
    </div>
  );
}

function CredentialValue({ label, value, sensitive = false }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-[10px] font-semibold text-waffarly-muted">{label}</span>
      <bdi className="break-all text-sm font-semibold text-waffarly-ink" dir={sensitive ? 'ltr' : 'auto'}>{value}</bdi>
    </div>
  );
}

function RuleStep({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-waffarly-kpi-gold text-xs font-bold text-waffarly-ink">{number}</span>
      <div className="min-w-0">
        <h3 className="m-0 text-xs font-bold text-waffarly-ink">{title}</h3>
        <p className="mb-0 mt-1 text-[11px] leading-5 text-waffarly-muted">{description}</p>
      </div>
    </div>
  );
}
