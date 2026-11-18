import type { LocalizedMessage } from '@waffarly/ui';
import { useEffect, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import type {
  MerchantStorefrontSettings,
  OwnerProfile,
  OwnerRestaurantSettings,
  SaveMerchantStorefrontRequest,
} from '@waffarly/contracts';
import { StorefrontDesignPreview, useLocale, Button, Input, Card } from '@waffarly/ui';
import { apiRequest, apiUpload } from './lib/api-client.js';
import { Icon } from './Icons.js';
import { storefrontUrl } from './lib/storefront-url.js';
import { Link } from 'react-router-dom';
import './storefront-design-controls.css';

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

function savedDesign(settings: MerchantStorefrontSettings): SaveMerchantStorefrontRequest {
  const defaultTemplate = settings.templates.find(
    ({ status, layout }) => status === 'available' && layout === 'hero',
  ) ?? settings.templates.find(({ status }) => status === 'available');
  return {
    templateId: settings.templateId ?? defaultTemplate?.id ?? '',
    ...colorValues(settings),
    logoScale: settings.logoScale,
    logoData: settings.logoData,
    revision: settings.revision,
  };
}

function contrastText(hex: string): string {
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(hex.slice(offset + 1, offset + 3), 16) / 255,
  );
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const luminance = red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.057;
  return whiteContrast >= darkContrast ? '#ffffff' : '#172330';
}

function mixWithBlack(hex: string, amount: number): string {
  const channels = [0, 2, 4].map((offset) =>
    Math.round(Number.parseInt(hex.slice(offset + 1, offset + 3), 16) * (1 - amount)),
  );
  return '#' + channels.map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const channels = [0, 2, 4].map((offset) => {
      const value = Number.parseInt(hex.slice(offset + 1, offset + 3), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

function readableForeground(backgrounds: string[]): string {
  const options = ['#ffffff', '#172330'];
  return options
    .map((color) => ({
      color,
      contrast: Math.min(...backgrounds.map((background) => contrastRatio(color, background))),
    }))
    .sort((first, second) => second.contrast - first.contrast)[0]!.color;
}

function readableBrandColor(color: string, backgrounds: string[]): string {
  return Math.min(...backgrounds.map((background) => contrastRatio(color, background))) >= 4.5
    ? color
    : readableForeground(backgrounds);
}

function storefrontPreviewStyle(draft: SaveMerchantStorefrontRequest): CSSProperties {
  const primaryDeep = mixWithBlack(draft.primaryColor, 0.55);
  const pageSurfaces = [draft.backgroundColor, draft.surfaceColor];
  const accentOnPrimaryDeep =
    contrastRatio(draft.accentColor, primaryDeep) >= 4.5
      ? draft.accentColor
      : contrastText(primaryDeep);
  return {
    '--preview-ink': readableForeground(pageSurfaces),
    '--preview-primary-deep': primaryDeep,
    '--preview-primary-deep-foreground': contrastText(primaryDeep),
    '--preview-primary-deep-text': readableBrandColor(primaryDeep, pageSurfaces),
    '--preview-accent-on-primary-deep': accentOnPrimaryDeep,
    '--preview-accent': draft.accentColor,
    '--preview-accent-foreground': contrastText(draft.accentColor),
    '--preview-background': draft.backgroundColor,
    '--preview-surface': draft.surfaceColor,
  } as CSSProperties;
}

export function StorefrontSettings({
  profile,
  onDirtyChange,
  onBusyChange,
  identity,
}: {
  profile: OwnerProfile;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  identity?: Pick<OwnerRestaurantSettings, 'logoImage' | 'coverImage'> | undefined;
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
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  const baseline = settings ? savedDesign(settings) : null;
  const dirty = !!draft && !!baseline &&
    (draft.templateId !== baseline.templateId ||
      draft.logoScale !== baseline.logoScale ||
      draft.logoData !== baseline.logoData ||
      colorFields.some(({ key }) => colorInputs[key].toLowerCase() !== baseline[key].toLowerCase()));
  const invalidColors = colorFields.some(({ key }) => !isHexColor(colorInputs[key]));
  const template = settings?.templates.find(({ id }) => id === draft?.templateId);
  const logo = identity ? identity.logoImage?.src : draft?.logoData;
  const cover = identity ? identity.coverImage?.src : settings?.coverImageUrl;
  const ar = locale === 'ar';

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

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
        setDraft(savedDesign(data));
        setColorInputs(colorValues(data));
      })
      .catch((cause: unknown) => {
        if (current)
          setError(cause instanceof Error ? cause.message : 'Could not load the design library.');
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || busy || !dirty) return;
    if (template?.status !== 'available') {
      setError('Choose a business design before saving.');
      return;
    }
    if (invalidColors) {
      setError(locale === 'ar' ? 'أدخل كل لون بصيغة HEX مثل #315B43.' : 'Enter each color as HEX, such as #315B43.');
      return;
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
      setDraft(savedDesign(updated));
      setColorInputs(colorValues(updated));
      setNotice(ar ? 'تم حفظ المظهر. افتح المتجر وحدّث الصفحة لمراجعته.' : 'Appearance saved. Open and refresh your store to see it.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the design.');
    } finally {
      setOperation(null);
    }
  }

  return (
    <Card
      id="settings-identity"
      className="panel merchant-design settings-card settings-identity-card"
      aria-labelledby="merchant-design-heading"
    >
      <div className="settings-card-heading">
        <div className="settings-heading-copy">
          <span className="settings-section-icon mint">
            <Icon name="store" />
          </span>
          <div>
            <h2 id="merchant-design-heading">
              {profile.activity === 'restaurant'
                ? locale === 'ar'
                  ? 'مظهر متجرك المستقل'
                  : 'Your independent storefront'
                : t('Storefront design')}
            </h2>
            <p>
              {profile.activity === 'restaurant'
                ? locale === 'ar'
                  ? 'غيّر القالب والألوان هنا. شعار المطعم وغلافه يتعدلان من هوية المطعم.'
                  : 'Choose a template and colors here. Edit the shared logo and cover in Restaurant identity.'
                : locale === 'ar'
                  ? 'تحكم في الشعار والقالب والألوان التي يراها العملاء على رابطك الخاص.'
                  : 'Control the logo, template, and colors customers see on your storefront.'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {errorText(error)}
        </p>
      )}
      {notice && (
        <p className="merchant-design-notice" role="status">
          {t(notice)}
        </p>
      )}

      {loading ? (
        <p>{t('Loading business designs…')}</p>
      ) : !settings || !draft ? null : (
        <form className="settings-identity-form" onSubmit={(event) => void save(event)}>
          <div className="settings-public-storefront">
            <div className="settings-storefront-address">
              <span>{locale === 'ar' ? 'رابط المتجر للعملاء' : 'Customer storefront'}</span>
              <a href={customerUrl} dir="ltr" target="_blank" rel="noreferrer">
                {customerUrl}
              </a>
              {!handle && (
                <small>
                  {locale === 'ar'
                    ? 'هذا هو الرابط الحالي. يمكن تعيين عنوان فرعي للمتجر من الإدارة.'
                    : 'Current address. An administrator can assign a storefront subdomain.'}
                </small>
              )}
            </div>
            <div className="settings-storefront-actions">
              <Button type="button" variant="outline" onClick={() => void copyStorefrontUrl()}>
                {locale === 'ar' ? 'نسخ الرابط' : 'Copy link'}
              </Button>
              <a
                className="settings-open-store"
                href={customerUrl}
                target="_blank"
                rel="noreferrer"
              >
                {locale === 'ar' ? 'فتح المتجر' : 'Open store'} <Icon name="arrow" />
              </a>
            </div>
          </div>
          <fieldset className="settings-design-fields" disabled={busy}>
            {profile.activity === 'restaurant' ? (
              <section
                className="settings-shared-identity"
                aria-label={locale === 'ar' ? 'هوية المطعم المشتركة' : 'Shared restaurant identity'}
              >
                <div className="settings-shared-identity-copy">
                  <strong>
                    {locale === 'ar'
                      ? 'هوية واحدة في وفرلي ومتجرك'
                      : 'One identity across Waffarly and your store'}
                  </strong>
                  <p>
                    {locale === 'ar'
                      ? 'الاسم والشعار والغلاف بيتداروا من هوية المطعم. الشعار والغلاف هنا للمعاينة فقط.'
                      : 'Manage your name, logo, and cover from Restaurant identity. Their storefront preview is shown here.'}
                  </p>
                  <Link to="/settings?section=identity">
                    {locale === 'ar' ? 'تعديل هوية المطعم' : 'Edit restaurant identity'}
                    <Icon name="arrow" />
                  </Link>
                </div>
                <div className="settings-shared-identity-images">
                  <div className="settings-shared-logo">
                    {logo ? (
                      <img
                        src={logo}
                        alt={locale === 'ar' ? 'شعار ' + profile.merchantName : profile.merchantName + ' logo'}
                      />
                    ) : (
                      <strong>{profile.merchantName.slice(0, 1)}</strong>
                    )}
                  </div>
                  {cover && (
                    <img
                      className="settings-shared-cover"
                      src={cover}
                      alt={locale === 'ar' ? 'غلاف المطعم' : 'Restaurant cover'}
                    />
                  )}
                </div>
              </section>
            ) : (
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
              className="settings-storefront-design-controls"
              aria-label={locale === 'ar' ? 'ألوان المتجر' : 'Store colors'}
            >
              <div className="settings-design-section-heading">
                <div>
                  <h3>{locale === 'ar' ? 'ألوان متجرك المستقل' : 'Independent storefront colors'}</h3>
                  <p>
                    {locale === 'ar'
                      ? 'الألوان دي بتظهر على رابط متجرك فقط.'
                      : 'These colors appear on your standalone storefront.'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => choosePalette(palettes[0])}
                >
                  {locale === 'ar' ? 'استعادة الألوان الافتراضية' : 'Restore default colors'}
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

              <fieldset className="settings-logo-size">
                <legend>{locale === 'ar' ? 'حجم الشعار على المتجر' : 'Storefront logo size'}</legend>
                {logoScales.map(({ value, ar, en }) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="storefront-logo-size"
                      value={value}
                      checked={draft.logoScale === value}
                      onChange={() =>
                        setDraft((current) => (current ? { ...current, logoScale: value } : current))
                      }
                    />
                    {locale === 'ar' ? ar : en}
                  </label>
                ))}
              </fieldset>
            </section>

            {settings.templates.some(({ status }) => status === 'available') && (
              <section className="settings-template-details" aria-labelledby="storefront-template-heading">
                <h3 id="storefront-template-heading">{ar ? 'ترتيب الصفحة الرئيسية' : 'Homepage layout'}</h3>
                <div className="merchant-design-grid">
                  {settings.templates.filter(({ status }) => status === 'available').map((template) => (
                    <Button
                      key={template.id}
                      type="button"
                      variant="outline"
                      className={`merchant-design-choice ${draft.templateId === template.id ? 'merchant-design-choice-active' : ''}`}
                      aria-pressed={draft.templateId === template.id}
                      onClick={() => {
                        setDraft((current) => current ? { ...current, templateId: template.id } : current);
                        setError('');
                        setNotice('');
                      }}
                    >
                      <StorefrontDesignPreview
                        layout={template.layout}
                        name={profile.merchantName}
                        description={template.description}
                        accentColor={
                          draft.templateId === template.id ? draft.primaryColor : template.accentColor
                        }
                        logoData={logo ?? null}
                      />
                      <span className="merchant-design-choice-copy">
                        <strong>{template.name}</strong>
                        <span className="merchant-design-radio" aria-hidden="true">
                          {draft.templateId === template.id ? '✓' : ''}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              </section>
            )}

            <section
              className="settings-live-preview-section"
              aria-label={locale === 'ar' ? 'معاينة المتجر' : 'Storefront preview'}
            >
              <div className="settings-design-section-heading">
                <div>
                  <h3>{locale === 'ar' ? 'معاينة مباشرة' : 'Live preview'}</h3>
                  <p>
                    {locale === 'ar'
                      ? 'شوف تأثير الشعار والألوان قبل الحفظ.'
                      : 'See how the logo and colors look before saving.'}
                  </p>
                </div>
                <div
                  className="settings-preview-toggle"
                  role="group"
                  aria-label={locale === 'ar' ? 'حجم المعاينة' : 'Preview size'}
                >
                  {(['desktop', 'mobile'] as const).map((viewport) => (
                    <button
                      key={viewport}
                      type="button"
                      aria-pressed={previewViewport === viewport}
                      onClick={() => setPreviewViewport(viewport)}
                    >
                      {viewport === 'desktop'
                        ? locale === 'ar'
                          ? 'كمبيوتر'
                          : 'Desktop'
                        : locale === 'ar'
                          ? 'موبايل'
                          : 'Mobile'}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className={'settings-live-preview ' + previewViewport + (template?.layout === 'menu' ? ' is-menu-first' : '')}
                style={storefrontPreviewStyle(draft)}
              >
                <div className="settings-preview-header">
                  <span className={'settings-preview-logo ' + draft.logoScale}>
                    {logo ? (
                      <img src={logo} alt="" />
                    ) : (
                      profile.merchantName.slice(0, 1)
                    )}
                  </span>
                  <strong>{profile.merchantName}</strong>
                  <span className="settings-preview-links">
                    {locale === 'ar' ? 'الرئيسية　 المنيو　 مفضلاتي' : 'Home　 Menu　 Favorites'}
                  </span>
                </div>
                <div className="settings-preview-hero">
                  {cover && <img src={cover} alt="" />}
                  <div>
                    <small>
                      {locale === 'ar'
                        ? profile.activity === 'restaurant'
                          ? 'مطعمك، بطريقتك'
                          : 'علامتك، بطريقتك'
                        : profile.activity === 'restaurant'
                          ? 'Your restaurant, your way'
                          : 'Your brand, your way'}
                    </small>
                    <strong>
                      {locale === 'ar' ? 'طعم يستاهل التجربة' : 'A taste worth coming back for'}
                    </strong>
                    <span className="settings-preview-cta">{ar ? 'اطلب الآن' : 'Order now'}</span>
                  </div>
                </div>
                <div className="settings-preview-product">
                  <span className="settings-preview-food" aria-hidden="true" />
                  <div>
                    <strong>{locale === 'ar' ? 'وجبة مميزة' : 'Signature meal'}</strong>
                    <small>{locale === 'ar' ? 'طازج ولذيذ كل مرة' : 'Fresh and delicious every time'}</small>
                  </div>
                  <b>{locale === 'ar' ? '١٨٠ ج.م' : 'EGP 180'}</b>
                </div>
              </div>
            </section>
          </fieldset>
          {invalidColors && (
            <p className="error" role="status">
              {ar ? 'اكتب اللون بصيغة زي #315B43.' : 'Use a color code such as #315B43.'}
            </p>
          )}
          {template?.status !== 'available' && (
            <p className="error" role="status">
              {settings.templates.some(({ status }) => status === 'available')
                ? ar ? 'اختار قالب متاح عشان تحفظ المظهر.' : 'Choose an available layout to save.'
                : ar ? 'مفيش قالب متاح حاليًا للحفظ.' : 'No template is currently available to save.'}
            </p>
          )}
          <footer className="rs-savebar settings-design-savebar">
            <span role="status">
              <i className={dirty ? 'is-dirty' : ''} />
              {operation === 'uploading'
                ? ar ? 'جارٍ رفع الصورة…' : 'Uploading image…'
                : operation === 'saving'
                  ? t('Saving…')
                  : dirty
                    ? ar ? 'عندك تغييرات غير محفوظة' : 'Unsaved changes'
                    : ar ? 'مفيش تغييرات جديدة' : 'No new changes'}
            </span>
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !dirty}
                onClick={() => {
                  setDraft(savedDesign(settings));
                  setColorInputs(colorValues(settings));
                  setError('');
                  setNotice('');
                }}
              >
                {ar ? 'تراجع عن التغييرات' : 'Discard changes'}
              </Button>
              <Button type="submit" disabled={busy || !dirty || invalidColors || template?.status !== 'available'}>
                {t('Save design')}
              </Button>
            </div>
          </footer>
        </form>
      )}
    </Card>
  );
}
