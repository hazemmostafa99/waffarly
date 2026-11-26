import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Dialog, useLocale } from '@waffarly/ui';
import type { SubscriptionCommand, SubscriptionDetail } from '@waffarly/contracts';
import { StatusBadge } from '../../components/StatusBadge.js';
import { formatSubscriptionMoney } from './subscription-money.js';
import { subscriptionActions } from './subscription-actions.js';
import { subscriptionStatusLabels } from './subscription-status.js';

export interface SavedSubscription {
  action: SubscriptionCommand['action'];
  detail: SubscriptionDetail;
}

/** Confirms a completed subscription action and summarizes the resulting plan and coverage. */
export function SubscriptionSavedDialog({
  saved,
  onClose,
}: {
  saved: SavedSubscription | null;
  onClose: () => void;
}) {
  const { t, formatDate, locale } = useLocale();
  if (!saved) return null;
  const { action, detail } = saved;
  const period = detail.currentPeriod;
  const tone =
    detail.status === 'active' ? 'success' : detail.status === 'cancelled' ? 'neutral' : 'warning';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('Subscription updated.')}
      closeLabel={t('Close')}
      className="admin-dialog"
    >
      <div className="admin-section grid admin-stack">
        <div className="flex items-start gap-3 rounded-lg bg-waffarly-kpi-mint p-3">
          <CheckCircle2
            className="mt-0.5 shrink-0 text-waffarly-primary"
            size={20}
            aria-hidden="true"
          />
          <p className="m-0 text-sm leading-6 text-waffarly-ink">
            <strong>{t(subscriptionActions[action])}</strong>
            {' — '}
            <bdi>{detail.merchantName}</bdi>
          </p>
        </div>
        <dl className="m-0 grid gap-3 sm:grid-cols-2">
          <SummaryValue label={t('Business name')}>
            <bdi>{detail.merchantName}</bdi>
          </SummaryValue>
          <SummaryValue label={t('Subscription status')}>
            <StatusBadge tone={tone}>{t(subscriptionStatusLabels[detail.status])}</StatusBadge>
          </SummaryValue>
          <SummaryValue label={t('Plan')}>
            {period ? period.planName : <span>{t('Not assigned')}</span>}
          </SummaryValue>
          <SummaryValue label={t('Duration')}>
            {period ? t('{{months}} months', { months: period.months }) : '—'}
          </SummaryValue>
          <SummaryValue label={t('Starts at')}>
            {period ? formatDate(period.startsAt) : '—'}
          </SummaryValue>
          <SummaryValue label={t('Ends at')}>
            {detail.endsAt ? formatDate(detail.endsAt) : t('No end date')}
          </SummaryValue>
          {period && (
            <SummaryValue label={t('Collected')}>
              {formatSubscriptionMoney(period.collected, locale)}
            </SummaryValue>
          )}
        </dl>
        {detail.cancelAtEnd && (
          <p className="m-0 text-xs text-waffarly-muted">{t('Cancels at period end')}</p>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-waffarly-border pt-3">
          <Button asChild variant="outline" onClick={onClose}>
            <Link to={`/subscriptions?merchant=${detail.merchantId}`}>
              {t('Manage subscription')}
            </Link>
          </Button>
          <Button type="button" onClick={onClose}>
            {t('Done')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function SummaryValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-xs text-waffarly-muted">{label}</dt>
      <dd className="m-0 text-start text-sm font-semibold text-waffarly-ink">{children}</dd>
    </div>
  );
}
