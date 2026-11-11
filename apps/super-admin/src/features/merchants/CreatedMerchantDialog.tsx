import { CheckCircle2 } from 'lucide-react';
import { Button, Dialog, useLocale } from '@waffarly/ui';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge.js';
import {
  merchantHasAccess,
  merchantSubscriptionStatus,
  subscriptionStatusLabels,
} from '../subscriptions/subscription-status.js';
import type { CreatedMerchantResult } from './created-merchant-store.js';
import { storefrontUrl } from '../../lib/storefront-url.js';

export function CreatedMerchantDialog({
  result,
  onClose,
}: {
  result: CreatedMerchantResult | null;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  if (!result) return null;
  const { merchant, password } = result;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('Business created')}
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
          <p className="m-0 text-xs leading-5 text-waffarly-ink">
            {t('Verify the owner by phone, then send these details privately to')}{' '}
            <bdi dir="ltr" className="font-semibold">
              {merchant.ownerMobile}
            </bdi>
            {t('. The password is shown here only until this panel is dismissed.')}
          </p>
        </div>
        <dl className="m-0 grid gap-3 sm:grid-cols-2">
          <CredentialValue label={t('Business name')} value={merchant.name} direction="auto" />
          {merchant.storefrontHandle && (
            <CredentialValue
              label={locale === 'ar' ? 'عنوان المتجر' : 'Storefront address'}
              value={storefrontUrl(merchant.storefrontHandle) ?? merchant.storefrontHandle}
              direction="ltr"
            />
          )}
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs text-waffarly-muted">{t('Subscription status')}</dt>
            <dd className="m-0">
              <StatusBadge tone={merchantHasAccess(merchant) ? 'success' : 'warning'}>
                {t(subscriptionStatusLabels[merchantSubscriptionStatus(merchant)])}
              </StatusBadge>
            </dd>
          </div>
          <CredentialValue label={t('Username')} value={merchant.username} direction="ltr" />
          <CredentialValue label={t('Password')} value={password} direction="ltr" />
          <CredentialValue
            label={t('Owner mobile number')}
            value={merchant.ownerMobile}
            direction="ltr"
          />
        </dl>
        <div className="flex flex-wrap justify-end gap-2 border-t border-waffarly-border pt-3">
          <Button asChild variant="outline" onClick={onClose}>
            <Link to={`/merchants/${merchant.id}`}>{t('View business')}</Link>
          </Button>
          <Button asChild variant="outline" onClick={onClose}>
            <Link to={`/subscriptions?merchant=${merchant.id}`}>{t('Manage subscription')}</Link>
          </Button>
          <Button type="button" onClick={onClose}>
            {t('Done')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CredentialValue({
  label,
  value,
  direction,
}: {
  label: string;
  value: string;
  direction: 'auto' | 'ltr';
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-xs text-waffarly-muted">{label}</dt>
      <dd className="m-0 break-all text-start text-sm font-semibold text-waffarly-ink">
        <bdi dir={direction}>{value}</bdi>
      </dd>
    </div>
  );
}
