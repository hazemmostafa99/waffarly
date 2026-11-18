import { useEffect, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { Button, Card, Dialog, useLocale } from '@waffarly/ui';
import type { OwnerProfile, OwnerRestaurantSettings } from '@waffarly/contracts';
import { Icon } from '../../Icons.js';
import { StorefrontSettings } from '../../StorefrontSettings.js';
import { RestaurantSettings } from './RestaurantSettings.js';
import './restaurant-settings.css';
type Tab = 'identity' | 'hours' | 'delivery' | 'design' | 'account';
const tabs: { id: Tab; icon: string; ar: string; en: string; description: string }[] = [
  {
    id: 'identity',
    icon: 'store',
    ar: 'هوية المطعم',
    en: 'Restaurant identity',
    description: 'الاسم والشعار والغلاف في وفرلي ومتجرك',
  },
  {
    id: 'hours',
    icon: 'clock',
    ar: 'مواعيد العمل',
    en: 'Opening hours',
    description: 'الجدول الأسبوعي والإجازات',
  },
  {
    id: 'delivery',
    icon: 'location',
    ar: 'التوصيل والاستلام',
    en: 'Delivery & pickup',
    description: 'الرسوم والمناطق والمدة',
  },
  {
    id: 'design',
    icon: 'settings',
    ar: 'مظهر المتجر المستقل',
    en: 'Storefront design',
    description: 'ترتيب الصفحة والألوان وحجم الشعار',
  },
  {
    id: 'account',
    icon: 'customers',
    ar: 'الحساب والاشتراك',
    en: 'Account & subscription',
    description: 'بيانات المالك وتسجيل الدخول والاشتراك',
  },
];
export function RestaurantSettingsWorkspace({
  profile,
  onNameSaved,
}: {
  profile: OwnerProfile;
  onNameSaved: (name: string) => void;
}) {
  const { locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const selected = params.get('section');
  const active: Tab = tabs.find((entry) => entry.id === selected)?.id ?? 'identity';
  const setActive = (id: Tab) => {
    if (id === active) return;
    const next = new URLSearchParams(params);
    next.set('section', id);
    setParams(next);
  };
  const [profileDirty, setProfileDirty] = useState(false);
  const [designDirty, setDesignDirty] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [designBusy, setDesignBusy] = useState(false);
  const [identity, setIdentity] =
    useState<Pick<OwnerRestaurantSettings, 'logoImage' | 'coverImage'>>();
  const dirty = profileDirty || designDirty;
  const busy = profileBusy || designBusy;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || busy) && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  return (
    <div className="rs-workspace">
      <h1 className="sr-only">{locale === 'ar' ? 'إعدادات المتجر' : 'Store settings'}</h1>
      <aside className="rs-navigation">
        <nav aria-label={locale === 'ar' ? 'أقسام الإعدادات' : 'Settings sections'}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-current={active === entry.id ? 'page' : undefined}
              className={active === entry.id ? 'is-active' : ''}
              onClick={() => setActive(entry.id)}
            >
              <span className="rs-nav-icon">
                <Icon name={entry.icon} />
              </span>
              <span>
                <strong>{locale === 'ar' ? entry.ar : entry.en}</strong>
                <small>{entry.description}</small>
              </span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="rs-main">
        <div hidden={!['identity', 'hours', 'delivery'].includes(active)}>
          <RestaurantSettings
            profile={profile}
            onSaved={({ name, logoImage, coverImage }) => {
              onNameSaved(name);
              setIdentity({ logoImage, coverImage });
            }}
            onDirtyChange={setProfileDirty}
            onBusyChange={setProfileBusy}
            activeSection={active === 'hours' || active === 'delivery' ? active : 'identity'}
          />
        </div>
        <div hidden={active !== 'design'} className="rs-design">
          <StorefrontSettings
            profile={profile}
            onDirtyChange={setDesignDirty}
            onBusyChange={setDesignBusy}
            identity={identity}
          />
        </div>
        <div hidden={active !== 'account'}>
          <Card className="rs-panel">
            <div className="rs-card-heading">
              <span className="rs-section-icon">
                <Icon name="customers" />
              </span>
              <div>
                <h3>حسابك واشتراكك</h3>
                <p>بيانات المالك والتواصل والفواتير في صفحة الحساب.</p>
              </div>
            </div>
            <div className="rs-account-details">
              <div>
                <small>اسم النشاط</small>
                <strong>{profile.merchantName}</strong>
              </div>
              <div>
                <small>اسم المالك</small>
                <strong>
                  {profile.ownerName === 'Reference demo' ? 'حساب عرض تجريبي' : profile.ownerName}
                </strong>
              </div>
            </div>
            <Link className="rs-link-button" to="/account">
              فتح إدارة الحساب <Icon name="arrow" />
            </Link>
          </Card>
        </div>
      </div>
      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title={busy ? 'فيه عملية شغالة' : dirty ? 'عندك تغييرات غير محفوظة' : 'مغادرة الإعدادات'}
        closeLabel="إغلاق"
      >
        <div className="p-5">
          <p className="text-sm leading-6">
            {busy
              ? 'استنى لحد ما الرفع أو الحفظ يخلص.'
              : dirty
                ? 'لو خرجت، التغييرات اللي لسه ما حفظتهاش هتضيع.'
                : 'كل التغييرات محفوظة.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                if (blocker.state === 'blocked') blocker.reset();
              }}
            >
              الرجوع للإعدادات
            </Button>
            {!busy && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (blocker.state === 'blocked') blocker.proceed();
                }}
              >
                {dirty ? 'تجاهل التغييرات والخروج' : 'خروج'}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
