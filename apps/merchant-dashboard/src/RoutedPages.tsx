import { useOutletContext } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import type { OwnerProfile } from '@waffarly/contracts';
import { Button, Card, Input, useLocale } from '@waffarly/ui';
import { CatalogWorkspace } from './CatalogWorkspace.js';
import { StorefrontSettings } from './StorefrontSettings.js';
import { Icon } from './Icons.js';

export function CatalogRoute({ section }: { section: 'products' | 'categories' | 'media' }) {
  const { search } = useOutletContext<{ search: string }>();
  return <CatalogWorkspace section={section} search={search} />;
}

export function SettingsRoute() {
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const { t } = useLocale();
  const [form, setForm] = useState({
    merchantName: profile.merchantName,
    email: 'ahmed@waffarly.com',
    phone: profile.contactPhone,
    timezone: 'cairo',
  });
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    orders: true,
    status: true,
    marketing: false,
  });

  function updateForm(field: keyof typeof form, value: string) {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
  }

  function toggleNotification(key: keyof typeof notifications) {
    setNotifications((current) => ({ ...current, [key]: !current[key] }));
  }

  const notificationItems = [
    ['orders', 'New order notifications', 'Get notified when a new order arrives.', 'bag'],
    ['status', 'Order status updates', 'Get notified when an order status changes.', 'file'],
    [
      'marketing',
      'Marketing and offers',
      'Get updates about offers and new features.',
      'megaphone',
    ],
  ] as const;

  return (
    <div className="merchant-settings-page">
      <nav className="settings-secondary-nav" aria-label={t('Settings sections')}>
        <a className="is-active" href="#settings-general" aria-current="page">
          <Icon name="settings" />
          <span>{t('General information')}</span>
        </a>
        <a href="#settings-identity">
          <Icon name="store" />
          <span>{t('Store identity')}</span>
        </a>
        <a href="#settings-notifications">
          <Icon name="bell" />
          <span>{t('Notifications')}</span>
        </a>
        <a href="#settings-security">
          <Icon name="shield" />
          <span>{t('Security')}</span>
        </a>
      </nav>

      <div className="settings-sections">
        <Card id="settings-general" className="panel settings-card settings-general-card">
          <div className="settings-card-heading">
            <div className="settings-heading-copy">
              <span className="settings-section-icon green">
                <Icon name="settings" />
              </span>
              <div>
                <div className="settings-eyebrow">{t('STORE SETTINGS')}</div>
                <h2>{t('Contact details')}</h2>
                <p>
                  {t('Basic information about your business and how it appears in the system.')}
                </p>
              </div>
            </div>
          </div>
          <h3 className="settings-profile-heading">{profile.merchantName}</h3>
          <form className="settings-form" onSubmit={saveGeneral}>
            <div className="settings-fields-grid">
              <label>
                <span>
                  {t('Business name')} <b>*</b>
                </span>
                <Input
                  value={form.merchantName}
                  onChange={(event) => updateForm('merchantName', event.target.value)}
                />
                <small>{t('This name appears on your storefront and customer pages.')}</small>
              </label>
              <label>
                <span>
                  {t('Email')} <b>*</b>
                </span>
                <Input
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                />
                <small>{t('Used for important store notifications.')}</small>
              </label>
              <label>
                <span>{t('Business phone')}</span>
                <Input
                  dir="ltr"
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                />
                <small>{t('The number customers use to contact you.')}</small>
              </label>
              <label>
                <span>{t('Time zone')}</span>
                <select
                  value={form.timezone}
                  onChange={(event) => updateForm('timezone', event.target.value)}
                >
                  <option value="cairo">{t('(GMT+2) Cairo')}</option>
                  <option value="riyadh">{t('(GMT+3) Riyadh')}</option>
                  <option value="dubai">{t('(GMT+4) Dubai')}</option>
                </select>
                <small>{t('Used for reports, schedules, and order times.')}</small>
              </label>
            </div>
            <div className="settings-form-footer">
              {saved ? (
                <span className="settings-saved" role="status">
                  {t('Changes saved')}
                </span>
              ) : (
                <span />
              )}
              <Button type="submit">{t('Save changes')}</Button>
            </div>
          </form>
        </Card>

        <StorefrontSettings profile={profile} />

        <Card
          id="settings-notifications"
          className="panel settings-card settings-notifications-card"
        >
          <div className="settings-card-heading">
            <div className="settings-heading-copy">
              <span className="settings-section-icon mint">
                <Icon name="bell" />
              </span>
              <div>
                <div className="settings-eyebrow">{t('CUSTOMER EXPERIENCE')}</div>
                <h2>{t('Notifications')}</h2>
                <p>{t('Choose the notifications you want to receive.')}</p>
              </div>
            </div>
          </div>
          <div className="settings-toggle-list">
            {notificationItems.map(([key, label, description, icon]) => (
              <div className="settings-toggle-row" key={key}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications[key as keyof typeof notifications]}
                  aria-label={t(label)}
                  className={`settings-switch ${notifications[key as keyof typeof notifications] ? 'is-on' : ''}`}
                  onClick={() => toggleNotification(key as keyof typeof notifications)}
                >
                  <span />
                </button>
                <div className="settings-toggle-copy">
                  <strong>{t(label)}</strong>
                  <small>{t(description)}</small>
                </div>
                <span className={`settings-toggle-icon ${key}`}>
                  <Icon name={icon} />
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card id="settings-security" className="panel settings-card settings-security-card">
          <div className="settings-card-heading">
            <div className="settings-heading-copy">
              <span className="settings-section-icon mint">
                <Icon name="shield" />
              </span>
              <div>
                <div className="settings-eyebrow">{t('ACCOUNT PROTECTION')}</div>
                <h2>{t('Security')}</h2>
                <p>{t('Manage the security settings for your account.')}</p>
              </div>
            </div>
          </div>
          <div className="settings-security-grid">
            <article className="settings-security-item">
              <span className="settings-security-icon amber">
                <Icon name="shield" />
              </span>
              <div>
                <h3>{t('Two-factor authentication')}</h3>
                <p>{t('Protect your account with an extra security step.')}</p>
                <Button type="button" variant="outline">
                  {t('Enable now')}
                </Button>
              </div>
            </article>
            <article className="settings-security-item">
              <span className="settings-security-icon blue">
                <Icon name="lock" />
              </span>
              <div>
                <h3>{t('Password')}</h3>
                <p>{t('Keep your password strong and up to date.')}</p>
                <Button type="button" variant="outline">
                  {t('Change password')}
                </Button>
              </div>
            </article>
          </div>
        </Card>
      </div>
    </div>
  );
}
