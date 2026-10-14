import { useState } from 'react';
import { ArrowLeft, Building2, Clock3, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { BUSINESS_ACTIVITY_LABELS, type MerchantSummary } from '@waffarly/contracts';
import { Button, Card, useLocale } from '@waffarly/ui';
import { PageHeader } from '../../components/PageHeader.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { useActivateFirstMonthMutation, useMerchantsQuery } from './merchant-queries.js';

export function MerchantDetailsPage() {
  const { merchantId } = useParams();
  const { t, formatDate, errorText } = useLocale();
  const merchants = useMerchantsQuery();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const activateFirstMonth = useActivateFirstMonthMutation();

  function requestActivation(merchant: MerchantSummary) {
    if (
      !window.confirm(
        t('Confirm that the first month was collected outside Waffarly for {{name}}?', {
          name: merchant.name,
        }),
      )
    ) {
      return;
    }
    setFeedback(null);
    activateFirstMonth.mutate(merchant.id, {
      onSuccess: (updatedMerchant) => {
        setFeedback({
          type: 'success',
          message: t('First month activated for {{name}}.', { name: updatedMerchant.name }),
        });
      },
      onError: (cause: unknown) => {
        setFeedback({
          type: 'error',
          message: errorText(cause instanceof Error ? cause.message : 'Something went wrong.'),
        });
      },
    });
  }

  if (merchants.isPending) {
    return <main className="grid min-h-48 place-content-center text-sm text-waffarly-muted" role="status">{t('Loading merchant details…')}</main>;
  }

  if (merchants.isError && !merchants.data) {
    return (
      <div className="grid gap-5">
        <PageHeader eyebrow={t('Merchant details')} title={t('Merchant record is unavailable.')} description={t('The merchant details could not be loaded.')} />
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          <span>{errorText(merchants.error instanceof Error ? merchants.error.message : 'Something went wrong.')}</span>
          <Button variant="outline" size="sm" className="border-waffarly-border bg-white text-waffarly-primary" onClick={() => void merchants.refetch()}>
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
          <p className="m-0 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
            {t('Showing the last available merchant list. Refresh it to check again.')}
          </p>
        )}
      </div>
    );
  }

  const activated = Boolean(merchant.firstMonthActivatedAt);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={t('Merchant details')}
        title={merchant.name}
        description={t('Created {{date}}', { date: formatDate(merchant.createdAt) })}
        actions={
          <>
            <BackToMerchants />
            {!activated && (
              <Button
                type="button"
                disabled={activateFirstMonth.isPending}
                className="bg-waffarly-primary text-white hover:bg-waffarly-primary-hover"
                onClick={() => requestActivation(merchant)}
              >
                <Clock3 size={16} aria-hidden="true" />
                {t('Activate first month')}
              </Button>
            )}
          </>
        }
      />

      {feedback && (
        <p
          className={`m-0 rounded-xl px-4 py-3 text-sm ${feedback.type === 'success' ? 'bg-waffarly-kpi-mint text-waffarly-primary' : 'bg-waffarly-danger-bg text-waffarly-danger'}`}
          role={feedback.type === 'success' ? 'status' : 'alert'}
        >
          {feedback.message}
        </p>
      )}

      {merchants.isError && (
        <p className="m-0 rounded-xl border border-waffarly-danger/20 bg-waffarly-danger-bg px-4 py-3 text-sm text-waffarly-danger" role="alert">
          {t('Showing the last available merchant list. Refresh it to check again.')}
        </p>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]" aria-label={t('Merchant overview')}>
        <Card className="grid gap-4 rounded-2xl border-waffarly-border bg-waffarly-surface p-4 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)] md:p-5">
          <div className="flex items-start gap-3 border-b border-waffarly-border pb-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-mint text-waffarly-primary">
              <Building2 size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-sm font-bold">{t('Business details')}</h2>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('Business activity')}: {t(BUSINESS_ACTIVITY_LABELS[merchant.activity ?? 'other'])}</p>
            </div>
          </div>
          <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField label={t('Business name')} value={merchant.name} />
            <DetailField label={t('Business contact number')} value={merchant.contactPhone} direction="ltr" />
          </dl>
        </Card>

        <Card className="grid gap-4 rounded-2xl border-waffarly-border bg-waffarly-surface p-4 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)] md:p-5">
          <div className="flex items-start gap-3 border-b border-waffarly-border pb-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-waffarly-kpi-blue text-waffarly-blue">
              <UserRound size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="m-0 text-sm font-bold">{t('Owner account')}</h2>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('Owner details currently available to the platform.')}</p>
            </div>
          </div>
          <dl className="m-0 grid gap-4">
            <DetailField label={t('Owner name')} value={merchant.ownerName} />
            <DetailField label={t('Owner mobile number')} value={merchant.ownerMobile} direction="ltr" />
            <DetailField label={t('Owner username')} value={merchant.username} direction="ltr" />
          </dl>
        </Card>

        <Card className="grid gap-4 rounded-2xl border-waffarly-border bg-waffarly-surface p-4 text-waffarly-ink shadow-[0_4px_16px_rgba(20,32,62,0.045)] xl:col-span-2 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-waffarly-border pb-4">
            <div>
              <h2 className="m-0 text-sm font-bold">{t('First-month access')}</h2>
              <p className="mb-0 mt-1 text-xs text-waffarly-muted">{t('The API currently exposes first-month activation only; no plan, expiry, or renewal details are available here.')}</p>
            </div>
            <StatusBadge tone={activated ? 'success' : 'warning'}>
              {activated ? t('First month activated') : t('Awaiting first-month activation')}
            </StatusBadge>
          </div>
          {merchant.firstMonthActivatedAt ? (
            <DetailField label={t('Activation recorded')} value={formatDate(merchant.firstMonthActivatedAt)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-waffarly-kpi-gold p-3">
              <p className="m-0 max-w-2xl text-xs leading-5 text-waffarly-ink">{t('Activate only after confirming that the first month was collected outside Waffarly.')}</p>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={activateFirstMonth.isPending}
                className="border-waffarly-border bg-white text-waffarly-primary hover:bg-white/80 hover:text-waffarly-primary"
                onClick={() => requestActivation(merchant)}
              >
                {t('Activate first month')}
              </Button>
            </div>
          )}
        </Card>
      </section>
    </div>
  );

}

function BackToMerchants() {
  const { t } = useLocale();
  return (
    <Button asChild variant="outline" className="border-waffarly-border bg-white text-waffarly-ink hover:bg-waffarly-input">
      <Link to="/merchants">
        <ArrowLeft size={16} aria-hidden="true" />
        {t('Back to businesses')}
      </Link>
    </Button>
  );
}

function DetailField({ label, value, direction = 'auto' }: { label: string; value: string; direction?: 'auto' | 'ltr' }) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-[11px] font-medium text-waffarly-muted">{label}</dt>
      <dd className="m-0 break-words text-sm font-semibold text-waffarly-ink" dir={direction}>{value}</dd>
    </div>
  );
}
