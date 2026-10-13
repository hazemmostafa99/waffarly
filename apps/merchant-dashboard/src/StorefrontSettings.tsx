import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  MerchantStorefrontSettings,
  OwnerProfile,
  SaveMerchantStorefrontRequest,
} from '@waffarly/contracts';
import { StorefrontDesignPreview } from '@waffarly/ui';
import { apiRequest } from './lib/api-client.js';

const defaultColor = '#315b43';
const maxLogoBytes = 48 * 1024;

export function StorefrontSettings({ profile }: { profile: OwnerProfile }) {
  const [settings, setSettings] = useState<MerchantStorefrontSettings | null>(null);
  const [draft, setDraft] = useState<SaveMerchantStorefrontRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  const selected = settings?.templates.find((template) => template.id === draft?.templateId);

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
    if (!draft?.templateId) return;
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
      setNotice('The design is saved for this restaurant.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the design.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel merchant-design" aria-labelledby="merchant-design-heading">
      <div className="merchant-design-intro">
        <div className="eyebrow">YOUR RESTAURANT</div>
        <h2 id="merchant-design-heading">Storefront design</h2>
        <p>Choose a complete design, add your logo, and make it yours with a signature color.</p>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="merchant-design-notice" role="status">
          {notice}
        </p>
      )}

      {loading ? (
        <p>Loading restaurant designs…</p>
      ) : !settings || !draft ? null : settings.templates.length === 0 ? (
        <div className="merchant-design-empty">
          <span aria-hidden="true">✳</span>
          <h3>Designs are on their way</h3>
          <p>Available restaurant designs will appear here.</p>
        </div>
      ) : (
        <form className="merchant-design-form" onSubmit={(event) => void save(event)}>
          <fieldset className="merchant-design-choices">
            <legend>Choose your design</legend>
            <div className="merchant-design-grid">
              {settings.templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
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
                    <span>
                      <strong>{template.name}</strong>
                      <small>
                        {template.layout === 'menu'
                          ? 'Editorial · menu first'
                          : 'Storytelling · welcome first'}
                      </small>
                    </span>
                    <span className="merchant-design-radio" aria-hidden="true">
                      {draft.templateId === template.id ? '✓' : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="merchant-design-customize">
            <div className="merchant-design-customize-heading">
              <div>
                <div className="eyebrow">YOUR PERSONAL TOUCH</div>
                <h3>Logo & colour</h3>
              </div>
              <span>Only changes this restaurant</span>
            </div>
            <div className="merchant-design-controls">
              <label className="merchant-logo-upload">
                Restaurant logo<span>PNG, JPG or WebP · max 48 KB</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} />
                <span className="merchant-file-button">
                  {draft.logoData ? 'Choose a different logo' : 'Choose a logo'}{' '}
                  <span aria-hidden="true">↗</span>
                </span>
              </label>
              {draft.logoData && (
                <button
                  className="merchant-logo-remove"
                  type="button"
                  onClick={() =>
                    setDraft((current) => (current ? { ...current, logoData: null } : current))
                  }
                >
                  Remove logo
                </button>
              )}
              <label className="merchant-colour-control">
                Your accent colour<span>Used for buttons and highlights</span>
                <span className="merchant-colour-picker">
                  <input
                    aria-label="Storefront accent colour"
                    type="color"
                    value={draft.accentColor}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, accentColor: event.target.value } : current,
                      )
                    }
                  />
                  <code>{draft.accentColor.toUpperCase()}</code>
                </span>
              </label>
            </div>
          </div>

          {selected && (
            <div className="merchant-design-live-preview">
              <div className="merchant-design-preview-label">
                <span>LIVE PREVIEW</span>
                <span>Example storefront · sample content</span>
              </div>
              <StorefrontDesignPreview
                layout={selected.layout}
                name={profile.merchantName}
                description={selected.description}
                accentColor={draft.accentColor || defaultColor}
                logoData={draft.logoData}
              />
            </div>
          )}

          <div className="merchant-design-save-row">
            <p>
              Saved to {profile.merchantName}'s restaurant only. The preview uses sample menu
              content.
            </p>
            <button type="submit" disabled={saving || !draft.templateId}>
              {saving ? 'Saving…' : 'Save design'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
