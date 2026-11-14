import { RestaurantSettingsWorkspace } from './features/restaurant/RestaurantSettingsWorkspace.js';
import type { MerchantOutletContext } from './lib/merchant-context.js';
import { Link, useOutletContext } from 'react-router-dom';
import { Button, Card, useLocale } from '@waffarly/ui';
import { CatalogWorkspace } from './CatalogWorkspace.js';
import { StorefrontSettings } from './StorefrontSettings.js';
import { Icon } from './Icons.js';

export function CatalogRoute({ section }: { section: 'products' | 'categories' | 'media' }) {
  const { search } = useOutletContext<{ search: string }>();
  return <CatalogWorkspace section={section} search={search} />;
}

export function SettingsRoute() {
  const { profile, updateProfile } = useOutletContext<MerchantOutletContext>();
  const { t, locale } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  if (profile.activity === 'restaurant')
    return (
      <RestaurantSettingsWorkspace
        key={profile.merchantId}
        profile={profile}
        onNameSaved={(merchantName) => updateProfile({ merchantName })}
      />
    );
  return (
    <div className="merchant-settings-page">
      <nav className="settings-secondary-nav" aria-label={t('Settings sections')}>
        <Link to="/account">
          <Icon name="customers" />
          <span>{text('My account', 'حسابي')}</span>
        </Link>
        <a className="is-active" href="#settings-identity" aria-current="page">
          <Icon name="store" />
          <span>{t('Store identity')}</span>
        </a>
      </nav>
      <div className="settings-sections">
        <Card id="settings-general" className="space-y-5 p-5 text-foreground sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="m-0 text-lg font-bold">{t('Contact details')}</h2>
              <p className="m-0 max-w-none text-sm text-muted-foreground">
                {text(
                  'Manage your business details and subscription from My account.',
                  'تقدر تعدّل بيانات نشاطك وتراجع اشتراكك من صفحة حسابي.',
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/account">{text('Manage account', 'إدارة الحساب')}</Link>
            </Button>
          </div>
          <dl className="grid gap-5 text-sm sm:grid-cols-2">
            {[
              [t('Business name'), profile.merchantName],
              [t('Owner name'), profile.ownerName],
              [t('Business phone'), profile.contactPhone],
              [t('Owner mobile'), profile.ownerMobile],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="m-0 mt-1 break-words font-semibold">
                  <bdi>{value}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <StorefrontSettings profile={profile} />
      </div>
    </div>
  );
}
