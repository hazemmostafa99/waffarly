import type { LocalizedMessage } from '@waffarly/ui';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  MerchantStorefrontSettings,
  OwnerProfile,
  SaveMerchantStorefrontRequest,
} from '@waffarly/contracts';
import { StorefrontDesignPreview, useLocale, Button, Input, Card } from '@waffarly/ui';
import { apiRequest } from './lib/api-client.js';
import { Icon } from './Icons.js';

const maxLogoBytes = 48 * 1024;
const storefrontBaseUrl = (import.meta.env.VITE_STOREFRONT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function StorefrontSettings({ profile }: { profile: OwnerProfile }) {
  const { t, errorText, locale } = useLocale();
  const [settings, setSettings] = useState<MerchantStorefrontSettings | null>(null);
  const [draft, setDraft] = useState<SaveMerchantStorefrontRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<LocalizedMessage>('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setDescription(
      locale === 'ar'
        ? 'وفّرلي يقدم أفضل أنواع الوافل والبرجر والحلويات الطازجة بمكونات عالية الجودة.'
        : 'Waffarly serves the best waffles, burgers, and fresh desserts made with quality ingredients.',
    );
  }, [locale]);

  useEffect(() => {
    let current = true;
    void apiRequest<MerchantStorefrontSettings>('/auth/owner/storefront')
      .then((data) => {
        if (!current) return;
        setSettings(data);
        setDraft({
          templateId: data.templateId ?? '',
          accentColor: data.accentColor,
          logoData: data.logoData,
          revision: data.revision,
        });
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
  }, []);

  function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file || !draft) return;
    setError('');
    setNotice('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPG, or WebP image.');
      event.currentTarget.value = '';
      return;
    }
    if (file.size > maxLogoBytes) {
      setError('The logo must be 48 KB or smaller.');
      event.currentTarget.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string')
        setDraft((current) =>
          current ? { ...current, logoData: reader.result as string } : current,
        );
    };
    reader.onerror = () => setError('This image could not be read. Try another file.');
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.templateId) {
      setError('Choose a business design before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await apiRequest<MerchantStorefrontSettings>('/auth/owner/storefront', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      setSettings(updated);
      setDraft({
        templateId: updated.templateId ?? '',
        accentColor: updated.accentColor,
        logoData: updated.logoData,
        revision: updated.revision,
      });
      setNotice('The design is saved for this business.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the design.');
    } finally {
      setSaving(false);
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
            <div className="settings-eyebrow">{t('STORE BRANDING')}</div>
            <h2 id="merchant-design-heading">{t('Storefront design')}</h2>
            <p>{t('Manage your store logo, description, and customer-facing identity.')}</p>
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
            <span>{locale === 'ar' ? 'رابط المتجر للعملاء' : 'Customer storefront'}</span>
            <a href={`${storefrontBaseUrl}/s/${settings.storefrontSlug}`} target="_blank" rel="noreferrer">
              {storefrontBaseUrl}/s/{settings.storefrontSlug}
            </a>
          </div>
          <div className="settings-identity-grid">
            <div className="settings-logo-column">
              <div className="settings-field-label">{t('Store logo')}</div>
              <div className="settings-logo-preview">
                {draft.logoData ? (
                  <img src={draft.logoData} alt={t('Current store logo')} />
                ) : (
                  <div className="settings-logo-wordmark">
                    <span aria-hidden="true">♨</span>
                    <strong>Waffarly</strong>
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
                <small>{t('PNG or JPG, up to 48 KB')}</small>
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
              <em>{description.length}/300</em>
            </label>
          </div>

          {settings.templates.length > 0 && (
            <details className="settings-template-details">
              <summary>{t('Choose your design')}</summary>
              <div className="merchant-design-grid">
                {settings.templates.map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    variant="outline"
                    className={`merchant-design-choice ${draft.templateId === template.id ? 'merchant-design-choice-active' : ''}`}
                    aria-pressed={draft.templateId === template.id}
                    onClick={() => {
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              templateId: template.id,
                              accentColor: settings.templateId
                                ? current.accentColor
                                : template.accentColor,
                            }
                          : current,
                      );
                      setError('');
                      setNotice('');
                    }}
                  >
                    <StorefrontDesignPreview
                      layout={template.layout}
                      name={profile.merchantName}
                      description={template.description}
                      accentColor={
                        draft.templateId === template.id ? draft.accentColor : template.accentColor
                      }
                      logoData={draft.logoData}
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
            </details>
          )}

          <div className="settings-card-footer">
            <p>{t('These changes apply to this business only.')}</p>
            <Button type="submit" disabled={saving || settings.templates.length === 0}>
              {saving ? t('Saving…') : t('Save design')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
