import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { Button, Card, Dialog, useLocale } from '@waffarly/ui';
import type { OwnerProfile } from '@waffarly/contracts';
import { Icon } from '../../Icons.js';
import { StorefrontSettings } from '../../StorefrontSettings.js';
import { RestaurantSettings, type RestaurantIdentityDraft } from './RestaurantSettings.js';
import { SettingsFeedback, SettingsHeading, SettingsSaveBar, type SettingsEditorActions } from './SettingsComponents.js';
import './restaurant-settings.css';
type Tab = 'identity' | 'publication' | 'hours' | 'delivery' | 'account';
const tabs: { id: Tab; icon: string; ar: string; en: string }[] = [
  {
    id: 'identity',
    icon: 'store',
    ar: 'الهوية والمظهر',
    en: 'Identity and appearance',
  },
  {
    id: 'publication',
    icon: 'store',
    ar: 'الظهور على وفرلي',
    en: 'Visibility on Wfarly',
  },
  {
    id: 'hours',
    icon: 'clock',
    ar: 'مواعيد العمل',
    en: 'Opening hours',
  },
  {
    id: 'delivery',
    icon: 'location',
    ar: 'التوصيل والاستلام',
    en: 'Delivery & pickup',
  },
  {
    id: 'account',
    icon: 'customers',
    ar: 'الحساب والاشتراك',
    en: 'Account & subscription',
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
  const ar = locale === 'ar';
  const [params, setParams] = useSearchParams();
  const selected = params.get('section');
  const active: Tab = tabs.find((entry) => entry.id === selected)?.id ?? 'identity';
  const setActive = (id: Tab) => {
    if (id === active || saving.current) return;
    setSummary(null);
    const next = new URLSearchParams(params);
    next.set('section', id);
    setParams(next);
  };
  const [profileDirty, setProfileDirty] = useState(false);
  const [designDirty, setDesignDirty] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [designBusy, setDesignBusy] = useState(false);
  const [identity, setIdentity] = useState<RestaurantIdentityDraft>();
  const [sectionDirty, setSectionDirty] = useState(false);
  const [invalidColors, setInvalidColors] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [summary, setSummary] = useState<{ identity?: boolean; appearance?: boolean } | null>(null);
  const saving = useRef(false);
  const restaurantEditor = useRef<SettingsEditorActions>(null);
  const appearanceEditor = useRef<SettingsEditorActions>(null);
  const branding = active === 'identity';
  const activeDirty = sectionDirty || (branding && designDirty);
  const currentTab = tabs.find(({ id }) => id === active)!;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDirty || busy || saving.current || (branding && invalidColors)) return;
    saving.current = true;
    setSavingAll(true);
    setSummary(null);
    const results: { identity?: boolean; appearance?: boolean } = {};
    try {
      if (sectionDirty && restaurantEditor.current) {
        results.identity = await restaurantEditor.current.save();
      }
      if (branding && designDirty && appearanceEditor.current) {
        results.appearance = await appearanceEditor.current.save();
      }
      if (branding) setSummary(results);
    } finally {
      saving.current = false;
      setSavingAll(false);
    }
  }
  const dirty = profileDirty || designDirty;
  const busy = savingAll || profileBusy || designBusy;
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
            <Button
              key={entry.id}
              type="button"
              variant="ghost"
              aria-current={active === entry.id ? 'page' : undefined}
              className={active === entry.id ? 'is-active' : ''}
              onClick={() => setActive(entry.id)}
            >
              <span className="rs-nav-icon">
                <Icon name={entry.icon} />
              </span>
              <span>
                <strong>{locale === 'ar' ? entry.ar : entry.en}</strong>
              </span>
            </Button>
          ))}
        </nav>
      </aside>
      <div className="rs-main">
        <Card className="rs-panel rs-unified-panel" hidden={active === 'account'}>
          <SettingsHeading
            id="restaurant-settings-heading"
            icon={currentTab.icon}
            title={ar ? currentTab.ar : currentTab.en}
          />
          <form aria-labelledby="restaurant-settings-heading" noValidate onSubmit={(event) => void save(event)}>
            <fieldset className="rs-unified-fields" disabled={savingAll}>
              <RestaurantSettings
                profile={profile}
                onSaved={({ name }) => onNameSaved(name)}
                onIdentityDraftChange={setIdentity}
                onSectionDirtyChange={setSectionDirty}
                onDirtyChange={setProfileDirty}
                onBusyChange={setProfileBusy}
                actionsRef={restaurantEditor}
                activeSection={active === 'account' ? 'identity' : active}
              />
              <div hidden={!branding}>
                <StorefrontSettings
                  profile={profile}
                  onDirtyChange={setDesignDirty}
                  onBusyChange={setDesignBusy}
                  onInvalidChange={setInvalidColors}
                  actionsRef={appearanceEditor}
                  identity={identity}
                  showPreview={branding}
                />
              </div>
            </fieldset>
            {branding && summary && (
              <SettingsFeedback
                error={summary.identity === false || summary.appearance === false
                  ? ar ? 'التعديلات اللي ما اتحفظتش لسه في المسودة.' : 'Unsaved edits are still in the draft.'
                  : ''}
                notice={summary.identity && summary.appearance
                  ? ar ? 'تم حفظ الهوية والمظهر.' : 'Identity and appearance saved.'
                  : summary.identity
                    ? ar ? 'تم حفظ بيانات المطعم.' : 'Restaurant details saved.'
                    : summary.appearance
                      ? ar ? 'تم حفظ المظهر.' : 'Appearance saved.'
                      : ''}
              />
            )}
            <SettingsSaveBar
              dirty={activeDirty}
              operation={savingAll ? 'saving' : busy ? 'uploading' : null}
              invalid={branding && invalidColors}
              label={ar ? 'حفظ' : 'Save'}
              onDiscard={() => {
                restaurantEditor.current?.discard();
                if (branding) appearanceEditor.current?.discard();
                setSummary(null);
              }}
            />
          </form>
        </Card>
        <div hidden={active !== 'account'}>
          <Card className="rs-panel" aria-labelledby="settings-account-heading">
            <SettingsHeading
              id="settings-account-heading"
              icon="customers"
              title={locale === 'ar' ? 'حسابك واشتراكك' : 'Account and subscription'}
            />
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
