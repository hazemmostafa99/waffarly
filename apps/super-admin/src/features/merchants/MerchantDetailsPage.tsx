import { useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, Copy, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { BUSINESS_ACTIVITY_LABELS } from '@waffarly/contracts';
import { Button, Card, useLocale } from '@waffarly/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { useMerchantsQuery } from './merchant-queries.js';

export function MerchantDetailsPage() {
  const { merchantId } = useParams();
  const { t, formatDate, errorText, locale } = useLocale();
  const isArabic = locale === 'ar';
  const merchants = useMerchantsQuery();
  const [businessCodeCopyState, setBusinessCodeCopyState] = useState<'copied' | 'failed' | null>(
    null,
  );
  async function copyBusinessCode(businessCode: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable.');
      await navigator.clipboard.writeText(businessCode);
      setBusinessCodeCopyState('copied');
      window.setTimeout(() => setBusinessCodeCopyState(null), 2000);
    } catch {
      setBusinessCodeCopyState('failed');
    }
  }

  if (merchants.isPending) {
    return (
      <main
        className="grid min-h-48 place-content-center text-sm text-waffarly-muted"
        role="status"
      >
        {t('Loading merchant details…')}
      </main>
    );
  }

  if (merchants.isError && !merchants.data) {
    return (
      <div className="grid gap-5">
        <PageHeader
          eyebrow={t('Merchant details')}
          title={t('Merchant record is unavailable.')}
          description={t('The merchant details could not be loaded.')}
        />
        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger"
          role="alert"
        >
          <span>
            {errorText(
              merchants.error instanceof Error ? merchants.error.message : 'Something went wrong.',
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-waffarly-border bg-white text-waffarly-primary"
            onClick={() => void merchants.refetch()}
          >
            {t('Try again')}
          </Button>
        </div>
      </div>
    );
  }

  const merchant = merchants.data?.find((item) => item.id === merchantId);
  if (!merchant) {
    return (
      <div className="grid gap-5">
        <PageHeader
          eyebrow={t('Merchant details')}
          title={t('Merchant not found')}
          description={t('No merchant record matches this address.')}
          actions={<BackToMerchants />}
        />
        {merchants.isError && (
          <p
            className="m-0 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger"
            role="alert"
          >
            {t('Showing the last available merchant list. Refresh it to check again.')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Merchant details')}
        title={merchant.name}
        description={t('Created {{date}}', { date: formatDate(merchant.createdAt) })}
        actions={
          <>
            <BackToMerchants />
            <Button asChild>
              <Link to={`/subscriptions?merchant=${merchant.id}`}>{t('Manage subscription')}</Link>
            </Button>
          </>
        }
      />

      {merchants.isError && (
        <p
          className="m-0 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger"
          role="alert"
        >
          {t('Showing the last available merchant list. Refresh it to check again.')}
        </p>
      )}

      <section
        className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"
        aria-label={t('Merchant overview')}
      >
        <Card className="grid gap-4 rounded-2xl border-waffarly-border bg-waffarly-surface p-4 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)] md:p-5">
          <div className="flex items-start gap-3 border-b border-waffarly-border pb-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary">
              <Building2 size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-sm font-bold">{t('Business details')}</h2>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">
                {t('Business activity')}:{' '}
                {t(BUSINESS_ACTIVITY_LABELS[merchant.activity ?? 'other'])}
              </p>
            </div>
          </div>
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField label={t('Business name')} value={merchant.name} />
            <DetailField
              label={t('Business contact number')}
              value={merchant.contactPhone}
              direction="ltr"
            />
            <div
              className="grid min-w-0 gap-1 text-start sm:col-span-2"
              dir={isArabic ? 'rtl' : 'ltr'}
            >
              <dt className="text-[11px] font-medium text-waffarly-muted">{t('Business code')}</dt>
              <dd
                className="m-0 flex flex-wrap items-center justify-start gap-2"
                dir={isArabic ? 'rtl' : 'ltr'}
              >
                <bdi
                  className="break-all rounded-md bg-waffarly-input px-2 py-1 text-left font-mono text-sm font-semibold text-waffarly-ink"
                  dir="ltr"
                >
                  {merchant.businessCode}
                </bdi>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-waffarly-border bg-white text-waffarly-primary hover:bg-waffarly-input"
                  aria-label={t('Copy business code')}
                  onClick={() => void copyBusinessCode(merchant.businessCode)}
                >
                  {businessCodeCopyState === 'copied' ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  {businessCodeCopyState === 'copied' ? t('Copied') : t('Copy business code')}
                </Button>
              </dd>
              <small
                className="text-start text-[11px] text-waffarly-muted"
                aria-live="polite"
                dir={isArabic ? 'rtl' : 'ltr'}
              >
                {businessCodeCopyState === 'failed'
                  ? t('Select the code to copy it manually.')
                  : businessCodeCopyState === 'copied'
                    ? t('Copied')
                    : t('Use this code when signing in to POS.')}
              </small>
            </div>
          </dl>
        </Card>

        <Card className="grid gap-4 rounded-2xl border-waffarly-border bg-waffarly-surface p-4 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)] md:p-5">
          <div className="flex items-start gap-3 border-b border-waffarly-border pb-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-blue">
              <UserRound size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="m-0 text-sm font-bold">{t('Owner account')}</h2>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">
                {t('Owner details currently available to the platform.')}
              </p>
            </div>
          </div>
          <dl className="m-0 grid gap-4">
            <DetailField label={t('Owner name')} value={merchant.ownerName} />
            <DetailField
              label={t('Owner mobile number')}
              value={merchant.ownerMobile}
              direction="ltr"
            />
            <DetailField label={t('Owner username')} value={merchant.username} direction="ltr" />
          </dl>
        </Card>

        <Card className="grid gap-4 border-waffarly-border p-5 xl:col-span-2">
          <h2 className="m-0 text-sm font-bold">{t('Subscription management')}</h2>
          <p className="m-0 text-sm text-waffarly-muted">
            {t('Review the current plan, coverage, collections, and subscription activity.')}
          </p>
          <Button asChild variant="outline">
            <Link to={`/subscriptions?merchant=${merchant.id}`}>{t('Manage subscription')}</Link>
          </Button>
        </Card>
      </section>
    </div>
  );
}

function BackToMerchants() {
  const { t, locale } = useLocale();
  const BackIcon = locale === 'ar' ? ArrowRight : ArrowLeft;
  return (
    <Button
      asChild
      variant="outline"
      className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input"
    >
      <Link to="/merchants">
        <BackIcon size={16} aria-hidden="true" />
        {t('Back to businesses')}
      </Link>
    </Button>
  );
}

function DetailField({
  label,
  value,
  direction = 'auto',
}: {
  label: string;
  value: string;
  direction?: 'auto' | 'ltr';
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-[11px] font-medium text-waffarly-muted">{label}</dt>
      <dd className="m-0 break-words text-start text-sm font-semibold text-waffarly-ink">
        <bdi dir={direction}>{value}</bdi>
      </dd>
    </div>
  );
}
