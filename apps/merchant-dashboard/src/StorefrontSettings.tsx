import type { LocalizedMessage } from '@waffarly/ui';
import { useEffect, useImperativeHandle, useState, type ChangeEvent, type FormEvent, type Ref } from 'react';
import type {
  MerchantStorefrontSettings,
  OwnerProfile,
  SaveMerchantStorefrontRequest,
  StorefrontHeroSettings,
} from '@waffarly/contracts';
import { useLocale, Button, Input, Card } from '@waffarly/ui';
import { apiRequest, apiUpload } from './lib/api-client.js';
import { Icon } from './Icons.js';
import { storefrontUrl } from './lib/storefront-url.js';
import { SettingsFeedback, SettingsHeading, SettingsSaveBar, type SettingsEditorActions } from './features/restaurant/SettingsComponents.js';
import { StorefrontPreview } from './features/restaurant/StorefrontPreview.js';
import { SettingsChoices } from './features/restaurant/SettingsChoices.js';
import type { RestaurantIdentityDraft } from './features/restaurant/RestaurantSettings.js';
import './storefront-appearance-controls.css';

const maxLogoBytes = 10 * 1024 * 1024;

const palettes = [
  {
    name: 'Waffarly',
    nameAr: 'وفّرلي',
    primaryColor: '#0f705a',
    accentColor: '#f5b544',
    backgroundColor: '#faf8f4',
    surfaceColor: '#ffffff',
  },
  {
    name: 'Garden',
    nameAr: 'جاردن',
    primaryColor: '#315b43',
    accentColor: '#c28942',
    backgroundColor: '#faf7ef',
    surfaceColor: '#ffffff',
  },
  {
    name: 'Golden Hour',
    nameAr: 'جولدن آور',
    primaryColor: '#8b442d',
    accentColor: '#d79a37',
    backgroundColor: '#fbf5ee',
    surfaceColor: '#fffdfa',
  },
  {
    name: 'Ocean',
    nameAr: 'أوشن',
    primaryColor: '#14566c',
    accentColor: '#258b83',
    backgroundColor: '#f1f8fa',
    surfaceColor: '#ffffff',
  },
  {
    name: 'Clay',
    nameAr: 'طين',
    primaryColor: '#783f32',
    accentColor: '#d48a64',
    backgroundColor: '#fcf4ee',
    surfaceColor: '#fffdfa',
  },
  {
    name: 'Olive',
    nameAr: 'زيتوني',
    primaryColor: '#47512e',
    accentColor: '#b69b54',
    backgroundColor: '#f6f4eb',
    surfaceColor: '#fffefa',
  },
  {
    name: 'Berry',
    nameAr: 'توت',
    primaryColor: '#663754',
    accentColor: '#d68ca5',
    backgroundColor: '#fbf3f7',
    surfaceColor: '#ffffff',
  },
  {
    name: 'Slate',
    nameAr: 'رمادي مزرق',
    primaryColor: '#30445f',
    accentColor: '#7f9db3',
    backgroundColor: '#f2f6fa',
    surfaceColor: '#ffffff',
  },
] as const;

const colorFields = [
  { key: 'primaryColor', ar: 'اللون الأساسي', en: 'Primary' },
  { key: 'accentColor', ar: 'لون التمييز', en: 'Accent' },
  { key: 'backgroundColor', ar: 'خلفية المتجر', en: 'Background' },
  { key: 'surfaceColor', ar: 'خلفية البطاقات', en: 'Cards' },
] as const;

type ColorKey = (typeof colorFields)[number]['key'];
type Palette = (typeof palettes)[number];
type LogoScale = SaveMerchantStorefrontRequest['logoScale'];
const logoScales = [
  { value: 'small', ar: 'صغير', en: 'Small' },
  { value: 'medium', ar: 'متوسط', en: 'Medium' },
  { value: 'large', ar: 'كبير', en: 'Large' },
] as const satisfies readonly { value: LogoScale; ar: string; en: string }[];
const heroShades = [
  { value: 'light', ar: 'خفيف', en: 'Light' },
  { value: 'medium', ar: 'متوسط', en: 'Medium' },
  { value: 'strong', ar: 'قوي', en: 'Strong' },
] as const satisfies readonly { value: StorefrontHeroSettings['heroShade']; ar: string; en: string }[];
const heroTextFields = [
  { key: 'heroEyebrow', ar: 'نص الشارة', en: 'Badge text', defaultAr: 'أطباق طازجة ولحظات أحلى', defaultEn: 'Fresh plates, brighter moments' },
  { key: 'heroTitle', ar: 'العنوان', en: 'Headline', defaultAr: 'أشهى الوجبات', defaultEn: 'Fresh food' },
  { key: 'heroEmphasis', ar: 'السطر المميز', en: 'Highlight', defaultAr: 'طعم على ذوقك', defaultEn: 'Made for you' },
] as const;

function colorValues(
  palette: Pick<MerchantStorefrontSettings, ColorKey>,
): Record<ColorKey, string> {
  return {
    primaryColor: palette.primaryColor,
    accentColor: palette.accentColor,
    backgroundColor: palette.backgroundColor,
    surfaceColor: palette.surfaceColor,
  };
}

const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

function savedAppearance(settings: MerchantStorefrontSettings): SaveMerchantStorefrontRequest {
  return {
    layout: settings.layout,
    ...colorValues(settings),
    logoScale: settings.logoScale,
    heroTitle: settings.heroTitle ?? null,
    heroEyebrow: settings.heroEyebrow ?? null,
    heroEmphasis: settings.heroEmphasis ?? null,
    heroShade: settings.heroShade ?? 'medium',
    logoData: settings.logoData,
    revision: settings.revision,
  };
}

export function StorefrontSettings({
  profile,
  onDirtyChange,
  onBusyChange,
  identity,
  actionsRef,
  onInvalidChange,
  showPreview = true,
}: {
  profile: OwnerProfile;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  identity?: RestaurantIdentityDraft | undefined;
  actionsRef?: Ref<SettingsEditorActions>;
  onInvalidChange?: (invalid: boolean) => void;
  showPreview?: boolean;
}) {
  const { t, errorText, locale, formatNumber } = useLocale();
  const [settings, setSettings] = useState<MerchantStorefrontSettings | null>(null);
  const [draft, setDraft] = useState<SaveMerchantStorefrontRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<'saving' | 'uploading' | null>(null);
  const busy = operation !== null;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const [description, setDescription] = useState('');
  const [colorInputs, setColorInputs] = useState<Record<ColorKey, string>>(
    colorValues(palettes[0]),
  );

  const baseline = settings ? savedAppearance(settings) : null;
  const dirty = !!draft && !!baseline &&
    (draft.logoScale !== baseline.logoScale ||
      draft.heroTitle !== baseline.heroTitle ||
      draft.heroEyebrow !== baseline.heroEyebrow ||
      draft.heroEmphasis !== baseline.heroEmphasis ||
      draft.heroShade !== baseline.heroShade ||
      draft.logoData !== baseline.logoData ||
      colorFields.some(({ key }) => colorInputs[key].toLowerCase() !== baseline[key].toLowerCase()));
  const invalidColors = colorFields.some(({ key }) => !isHexColor(colorInputs[key]));
  const ar = locale === 'ar';

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => onInvalidChange?.(invalidColors), [invalidColors, onInvalidChange]);

  useEffect(() => {
    setDescription(
      locale === 'ar'
        ? 'وفّرلي يقدم أفضل أنواع الوافل والبرجر والحلويات الطازجة بمكونات عالية الجودة.'
        : 'Waffarly serves the best waffles, burgers, and fresh desserts made with quality ingredients.',
    );
  }, [locale]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setNotice('');
    void apiRequest<MerchantStorefrontSettings>('/auth/owner/storefront')
      .then((data) => {
        if (!current) return;
        setSettings(data);
        setDraft(savedAppearance(data));
        setColorInputs(colorValues(data));
      })
      .catch((cause: unknown) => {
        if (current)
          setError(cause instanceof Error ? cause.message : 'Could not load storefront appearance.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [profile.merchantId]);

  const handle = settings?.storefrontHandle;
  const customerUrl = settings ? storefrontUrl(settings.storefrontSlug, handle) : '';

  async function copyStorefrontUrl() {
    try {
      await navigator.clipboard.writeText(customerUrl);
      setError('');
      setNotice(locale === 'ar' ? 'تم نسخ رابط المتجر.' : 'Store link copied.');
    } catch {
      setError(
        locale === 'ar'
          ? 'تعذر النسخ. يمكنك نسخ الرابط مباشرة.'
          : 'Could not copy. Select and copy the link directly.',
      );
    }
  }

  function updateColor(key: ColorKey, value: string) {
    setColorInputs((current) => ({ ...current, [key]: value }));
    setNotice('');
    if (isHexColor(value)) {
      setDraft((current) => (current ? { ...current, [key]: value.toLowerCase() } : current));
      setError('');
    }
  }

  function choosePalette(palette: Palette) {
    const colors = colorValues(palette);
    setColorInputs(colors);
    setDraft((current) => (current ? { ...current, ...colors } : current));
    setError('');
    setNotice('');
  }

  function changeHero<K extends keyof StorefrontHeroSettings>(key: K, value: StorefrontHeroSettings[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setNotice('');
  }

  function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file || !draft || busy) return;
    setError('');
    setNotice('');
    if (profile.activity === 'restaurant') return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPG, or WebP image.');
      event.currentTarget.value = '';
      return;
    }
    if (file.size > maxLogoBytes) {
      setError(
        locale === 'ar'
          ? 'حجم الشعار يجب ألا يتجاوز 10 ميجابايت.'
          : 'The logo must be 10 MB or smaller.',
      );
      event.currentTarget.value = '';
      return;
    }
    const input = event.currentTarget;
    setOperation('uploading');
    void apiUpload<{ publicUrl: string }>('/owner/catalog/media/upload', file)
      .then((asset) => {
        setDraft((current) => (current ? { ...current, logoData: asset.publicUrl } : current));
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'This image could not be uploaded.');
      })
      .finally(() => {
        input.value = '';
        setOperation(null);
      });
  }

  async function save(): Promise<boolean> {
    if (!draft || busy || !dirty) return false;
    if (invalidColors) {
      setError(locale === 'ar' ? 'أدخل كل لون بصيغة HEX مثل #315B43.' : 'Enter each color as HEX, such as #315B43.');
      return false;
    }
    setOperation('saving');
    setError('');
    setNotice('');
    try {
      const updated = await apiRequest<MerchantStorefrontSettings>('/auth/owner/storefront', {
        method: 'PATCH',
        body: JSON.stringify({ ...draft, logoData: profile.activity === 'restaurant' ? null : draft.logoData }),
      });
      setSettings(updated);
      setDraft(savedAppearance(updated));
      setColorInputs(colorValues(updated));
      if (!actionsRef) setNotice(ar ? 'تم الحفظ.' : 'Saved.');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the appearance.');
      return false;
    } finally {
      setOperation(null);
    }
  }

  function discard() {
    if (!settings) return;
    setDraft(savedAppearance(settings));
    setColorInputs(colorValues(settings));
    setError('');
    setNotice('');
  }
  useImperativeHandle(actionsRef, () => ({ save, discard }));

  const Panel = actionsRef ? 'div' : Card;
  const Fields = actionsRef ? 'div' : 'form';

  return (
    <Panel
      id={profile.activity === 'restaurant' ? 'settings-appearance' : 'settings-identity'}
      className={actionsRef ? "rs-appearance-fields" : "panel merchant-appearance settings-card settings-identity-card"}
      aria-labelledby={actionsRef ? undefined : "merchant-appearance-heading"}
    >
      {!actionsRef && <SettingsHeading
        id="merchant-appearance-heading"
        icon="settings"
        title={ar ? 'الهوية والمظهر' : 'Identity and appearance'}
      /> }
      <SettingsFeedback error={error ? errorText(error) : ''} notice={notice ? t(notice) : ''} />

      {loading ? (
        <p>{locale === 'ar' ? 'جارٍ تحميل مظهر المتجر…' : 'Loading storefront appearance…'}</p>
      ) : !settings || !draft ? null : (
        <Fields
          className="settings-identity-form"
          onSubmit={actionsRef ? undefined : (event: FormEvent<HTMLElement>) => {
            event.preventDefault();
            void save();
          }}
        >
          {profile.activity === 'restaurant' && (
            <fieldset className="settings-cover-copy" disabled={busy}>
              <legend>{ar ? 'نص الغلاف' : 'Cover text'}</legend>
              <div className="settings-cover-lines has-badge">
                {heroTextFields.map((field) => {
                  const label = ar ? field.ar : field.en;
                  const defaultText = ar ? field.defaultAr : field.defaultEn;
                  return (
                    <div key={field.key}>
                      <div className="settings-cover-field-heading">
                        <label htmlFor={field.key}>{label}</label>
                        <Button type="button" variant="ghost" size="sm"
                          className="settings-cover-reset"
                          aria-label={ar ? 'رجّع ' + label + ' للافتراضي' : 'Reset ' + label}
                          disabled={draft[field.key] == null}
                          onClick={() => changeHero(field.key, null)}>
                          {ar ? 'افتراضي' : 'Reset'}
                        </Button>
                      </div>
                      <Input
                        id={field.key}
                        maxLength={80}
                        value={draft[field.key] ?? defaultText}
                        onChange={(event) => changeHero(field.key, event.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="settings-cover-shade">
                <SettingsChoices<StorefrontHeroSettings['heroShade']>
                  label={ar ? 'تعتيم الصورة' : 'Image shade'}
                  value={draft.heroShade ?? 'medium'}
                  options={heroShades.map(({ value, ar: arabic, en }) => ({
                    value, label: ar ? arabic : en,
                  }))}
                  onChange={(value) => changeHero('heroShade', value)}
                />
                <Button type="button" variant="ghost" size="sm" className="settings-cover-reset"
                  aria-label={ar ? 'رجّع التعتيم للافتراضي' : 'Reset image shade'}
                  disabled={(draft.heroShade ?? 'medium') === 'medium'}
                  onClick={() => changeHero('heroShade', 'medium')}>
                  {ar ? 'افتراضي' : 'Reset'}
                </Button>
              </div>
            </fieldset>
          )}
          <div className="settings-public-storefront">
            <div className="settings-storefront-address">
              <span>{locale === 'ar' ? 'رابط المتجر للعملاء' : 'Customer storefront'}</span>
              <a href={customerUrl} dir="ltr" target="_blank" rel="noreferrer">
                {customerUrl}
              </a>
            </div>
            <div className="settings-storefront-actions">
              <Button type="button" size="sm" variant="outline" onClick={() => void copyStorefrontUrl()}>
                {locale === 'ar' ? 'نسخ الرابط' : 'Copy link'}
              </Button>
              <Button asChild size="sm" variant="solid">
                <a href={customerUrl} target="_blank" rel="noreferrer">
                  {ar ? 'فتح المتجر' : 'Open store'} <Icon name="arrow" />
                </a>
              </Button>
            </div>
          </div>
          <fieldset className="settings-appearance-fields" disabled={busy}>
            {profile.activity !== 'restaurant' && (
              <div className="settings-identity-grid">
                <div className="settings-logo-column">
                  <div className="settings-field-label">{t('Store logo')}</div>
                  <div className="settings-logo-preview">
                    {draft.logoData ? (
                      <img src={draft.logoData} alt={t('Current store logo')} />
                    ) : (
                      <div className="settings-logo-wordmark">
                        <span aria-hidden="true">♨</span>
                        <strong>{profile.merchantName}</strong>
                      </div>
                    )}
                  </div>
                  <label className="settings-logo-upload">
                    <Input
                      className="size-px p-0 opacity-0"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={uploadLogo}
                    />
                    <span>
                      {draft.logoData ? t('Choose a different logo') : t('Upload store logo')}
                    </span>
                    <small>
                      {locale === 'ar'
                        ? 'PNG أو JPG أو WebP، حتى 10 ميجابايت'
                        : 'PNG, JPG, or WebP, up to 10 MB'}
                    </small>
                  </label>
                  {draft.logoData && (
                    <Button
                      variant="ghost"
                      className="merchant-logo-remove"
                      type="button"
                      onClick={() =>
                        setDraft((current) => (current ? { ...current, logoData: null } : current))
                      }
                    >
                      {t('Remove logo')}
                    </Button>
                  )}
                </div>

                <label className="settings-description-field">
                  <span>{t('Store description')}</span>
                  <textarea
                    value={description}
                    maxLength={300}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                  <small>{t('A short description customers will see on your storefront.')}</small>
                  <em>
                    {formatNumber(description.length)}/{formatNumber(300)}
                  </em>
                </label>
              </div>
            )}

            <section
              className="settings-storefront-appearance-controls"
              aria-label={locale === 'ar' ? 'إعدادات مظهر المتجر' : 'Storefront appearance settings'}
            >
              <div className="settings-appearance-section-heading">
                <h3>{ar ? 'الألوان' : 'Colors'}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => choosePalette(palettes[0])}
                >
                  {ar ? 'الألوان الافتراضية' : 'Default colors'}
                </Button>
              </div>

              <div
                className="settings-palette-list"
                role="group"
                aria-label={locale === 'ar' ? 'مجموعات ألوان جاهزة' : 'Color palettes'}
              >
                {palettes.map((palette) => (
                  <button
                    key={palette.name}
                    type="button"
                    className="settings-palette-choice"
                    onClick={() => choosePalette(palette)}
                    aria-pressed={
                      colorFields.every(({ key }) => draft[key].toLowerCase() === palette[key])
                    }
                    aria-label={
                      locale === 'ar'
                        ? 'استخدم مجموعة ' + palette.nameAr
                        : 'Use ' + palette.name + ' palette'
                    }
                  >
                    <span className="settings-palette-swatches" aria-hidden="true">
                      <i style={{ background: palette.primaryColor }} />
                      <i style={{ background: palette.accentColor }} />
                      <i style={{ background: palette.backgroundColor }} />
                    </span>
                    <span>{locale === 'ar' ? palette.nameAr : palette.name}</span>
                  </button>
                ))}
              </div>

              <div className="settings-color-grid">
                {colorFields.map(({ key, ar, en }) => (
                  <label className="settings-color-field" key={key}>
                    <span>{locale === 'ar' ? ar : en}</span>
                    <div>
                      <input
                        type="color"
                        aria-label={
                          locale === 'ar' ? 'اختيار ' + ar : 'Choose ' + en.toLowerCase() + ' color'
                        }
                        value={draft[key]}
                        onChange={(event) => updateColor(key, event.target.value)}
                      />
                      <Input
                        value={colorInputs[key]}
                        maxLength={7}
                        aria-invalid={!isHexColor(colorInputs[key])}
                        aria-label={locale === 'ar' ? 'كود ' + ar : en + ' color HEX'}
                        onChange={(event) => updateColor(key, event.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </label>
                ))}
              </div>

              <SettingsChoices<LogoScale>
                label={ar ? 'حجم الشعار' : 'Logo size'}
                value={draft.logoScale}
                options={logoScales.map(({ value, ar: arabic, en }) => ({
                  value, label: ar ? arabic : en,
                }))}
                onChange={(logoScale) => setDraft((current) => current ? { ...current, logoScale } : current)}
              />

            </section>

          </fieldset>
          {showPreview && (
            <StorefrontPreview slug={settings.storefrontSlug} identity={identity} appearance={draft} />
          )}
          {invalidColors && (
            <p className="error" role="status">
              {ar ? 'اكتب اللون بصيغة زي #315B43.' : 'Use a color code such as #315B43.'}
            </p>
          )}
          {!actionsRef && (
            <SettingsSaveBar
              dirty={dirty}
              operation={operation}
              invalid={invalidColors}
              label={ar ? 'حفظ' : 'Save'}
              onDiscard={discard}
            />
          )}
        </Fields>
      )}
    </Panel>
  );
}
