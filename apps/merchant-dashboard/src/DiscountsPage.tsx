import { useCallback, useEffect, useState } from 'react';
import type {
  MerchantDiscount,
  MerchantDiscountInput,
  MerchantDiscountStats,
} from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { useOutletContext } from 'react-router-dom';
import type { MerchantOutletContext } from './lib/merchant-context.js';
import { apiRequest, ApiError } from './lib/api-client.js';
import { Icon } from './Icons.js';
import { discountsCopy } from './discounts-copy.js';
import { DiscountEditor } from './features/discounts/DiscountEditor.js';
import { presentation, type Discount } from './features/discounts/discount-model.js';

type Branch = { id: string; name: string };
const emptyStats: MerchantDiscountStats = {
  totalDiscountValue: '0.00',
  activeCoupons: 0,
  customersReached: 0,
  totalRedemptions: 0,
  totalCoupons: 0,
};
function statusLabel(status: Discount['status']) {
  return {
    active: 'Active',
    scheduled: 'Scheduled',
    draft: 'Draft',
    expired: 'Expired',
    paused: 'Paused',
  }[status];
}
function typeLabel(type: Discount['type']) {
  return type === 'percentage' ? 'Percentage discount' : 'Fixed discount';
}
function displayDateRange(start: string, end: string, locale: string) {
  const format = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Cairo',
  });
  return `${format.format(new Date(`${start}T12:00:00Z`))} – ${format.format(new Date(`${end}T12:00:00Z`))}`;
}
function amount(value: string, locale: string) {
  if (!value) return '';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function DiscountsPage() {
  const { t, locale, formatNumber, errorText } = useLocale();
  const { profile } = useOutletContext<MerchantOutletContext>();
  const copy = (message: string) => discountsCopy(message, locale, t);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<Discount | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '100', search: query, status, type });
    try {
      const [items, summary, branchRows] = await Promise.all([
        apiRequest<MerchantDiscount[]>(`/owner/discounts?${params}`),
        apiRequest<MerchantDiscountStats>('/owner/discounts/stats'),
        apiRequest<Branch[]>('/owner/discounts/branches'),
      ]);
      const mapped = items.map(presentation);
      setDiscounts(mapped);
      setStats(summary);
      setBranches(branchRows);
      setSelectedId((current) =>
        mapped.some((item) => item.id === current) ? current : (mapped[0]?.id ?? ''),
      );
    } catch (cause) {
      setError(errorText(cause instanceof ApiError ? cause.message : 'Could not load discounts.'));
    } finally {
      setLoading(false);
    }
  }, [errorText, query, status, type]);

  useEffect(() => {
    void reload();
  }, [reload, profile.merchantId]);
  const visibleDiscounts = discounts.filter(
    (item) => branch === 'all' || item.branches.length === 0 || item.branches.includes(branch),
  );
  const selected =
    visibleDiscounts.find((item) => item.id === selectedId) ?? visibleDiscounts[0] ?? null;
  function showNotice(message: string) {
    setNotice(copy(message));
    window.setTimeout(() => setNotice(''), 2600);
  }
  async function saveDiscount(draft: MerchantDiscountInput) {
    if (busy) return;
    setBusy(true);
    setError('');
    const body = editing
      ? { ...draft, revision: editing.revision }
      : { ...draft, requestId: crypto.randomUUID() };
    try {
      await apiRequest<MerchantDiscount>(
        editing ? `/owner/discounts/${editing.id}` : '/owner/discounts',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        },
      );
      setEditorOpen(false);
      setEditing(null);
      showNotice(editing ? 'Discount updated' : 'Discount created');
      await reload();
    } catch (cause) {
      setError(errorText(cause instanceof ApiError ? cause.message : 'Could not save discount.'));
    } finally {
      setBusy(false);
    }
  }
  const statCards = [
    {
      label: 'Total discount value',
      value: `${amount(stats.totalDiscountValue, locale)} EGP`,
      icon: 'database',
      tone: 'mint',
    },
    {
      label: 'Active coupons',
      value: formatNumber(stats.activeCoupons),
      icon: 'ticket',
      tone: 'cream',
    },
    {
      label: 'Customers reached',
      value: formatNumber(stats.customersReached),
      icon: 'customers',
      tone: 'blue',
    },
    {
      label: 'Total redemptions',
      value: formatNumber(stats.totalRedemptions),
      icon: 'tag',
      tone: 'lavender',
    },
  ] as const;

  return (
    <div className="discounts-page">
      <h1 className="sr-only">{copy('Discounts')}</h1>

      <div className="discounts-stat-grid" aria-label={copy('Discounts')}>
        {statCards.map((stat) => (
          <article className="discount-stat" key={stat.label}>
            <div className={`discount-stat-inner ${stat.tone}`}>
              <span className="discount-stat-icon">
                <Icon name={stat.icon} />
              </span>
              <div className="discount-stat-copy">
                <span>{copy(stat.label)}</span>
                <strong dir="auto">{stat.value}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="discounts-toolbar">
        <Button
          className="discounts-create-button"
          size="sm"
          type="button"
          onClick={() => {
            setError('');
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Icon name="plus" /> {copy('Create discount')}
        </Button>
        <div className="discounts-filter-controls">
          <label className="discounts-search">
            <Icon name="search" />
            <input
              aria-label={copy('Search by discount name or code...')}
              placeholder={copy('Search by discount name or code...')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="discount-select">
            <span className="discounts-sr-only">{copy('All statuses')}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">{copy('All statuses')}</option>
              {(['active', 'scheduled', 'draft', 'paused', 'expired'] as const).map((value) => (
                <option key={value} value={value}>
                  {copy(statusLabel(value))}
                </option>
              ))}
            </select>
            <Icon name="chevron" />
          </label>
          <label className="discount-select">
            <span className="discounts-sr-only">{copy('All types')}</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">{copy('All types')}</option>
              <option value="percentage">{copy('Percentage discount')}</option>
              <option value="fixed">{copy('Fixed discount')}</option>
            </select>
            <Icon name="chevron" />
          </label>
          <label className="discount-select">
            <span className="discounts-sr-only">{copy('All branches')}</span>
            <select value={branch} onChange={(event) => setBranch(event.target.value)}>
              <option value="all">{copy('All branches')}</option>
              {branches.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Icon name="chevron" />
          </label>
        </div>
      </div>

      {notice && (
        <div className="discounts-notice" role="status">
          {notice}
        </div>
      )}
      {error && !editorOpen && (
        <div className="discounts-error" role="alert">
          {error}
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            {copy('Retry')}
          </Button>
        </div>
      )}
      <div className="discounts-content-grid">
        <aside className="discount-details-card">
          <div className="discount-details-heading">
            <h2>{copy('Discount details')}</h2>
            <Button
              className="discount-icon-button"
              variant="ghost"
              size="icon"
              type="button"
              aria-label={copy('Edit')}
              disabled={!selected}
              onClick={() => {
                if (selected) {
                  setError('');
                  setEditing(selected);
                  setEditorOpen(true);
                }
              }}
            >
              <Icon name="edit" />
            </Button>
          </div>
          {selected ? (
            <>
              <div className={`discount-details-hero ${selected.tone}`}>
                <span className="discount-large-icon">
                  <Icon name={selected.icon} />
                </span>
                <h3>{copy(selected.name)}</h3>
                <Button
                  className="discount-code-chip"
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(selected.code)
                      .then(() => showNotice('Code copied'));
                  }}
                  title={copy('Code copied')}
                >
                  <code>{selected.code}</code>
                  <Icon name="copy" />
                </Button>
                <span className={`discount-status ${selected.status}`}>
                  <i /> {copy(statusLabel(selected.status))}
                </span>
              </div>
              <dl className="discount-details-list">
                <div>
                  <dt>{copy('Type')}</dt>
                  <dd>{copy(typeLabel(selected.type))}</dd>
                </div>
                <div>
                  <dt>{copy('Value')}</dt>
                  <dd dir="ltr">
                    {amount(selected.value, locale)}
                    {selected.type === 'percentage' ? '%' : ` EGP`}
                  </dd>
                </div>
                <div>
                  <dt>{copy('Minimum order')}</dt>
                  <dd dir="ltr">{amount(selected.minimum, locale)} EGP</dd>
                </div>
                <div>
                  <dt>{copy('Maximum discount')}</dt>
                  <dd dir="ltr">
                    {selected.maximum
                      ? `${amount(selected.maximum, locale)} EGP`
                      : copy('Unlimited')}
                  </dd>
                </div>
                <div>
                  <dt>{copy('Date range')}</dt>
                  <dd>{displayDateRange(selected.startDate, selected.endDate, locale)}</dd>
                </div>
                <div>
                  <dt>{copy('Usage limit')}</dt>
                  <dd dir="ltr">
                    {formatNumber(selected.redemptions)} /{' '}
                    {selected.usageLimit
                      ? formatNumber(Number(selected.usageLimit))
                      : copy('Unlimited')}
                  </dd>
                </div>
                <div>
                  <dt>{copy('Branches')}</dt>
                  <dd>
                    {selected.branches.length
                      ? selected.branches
                          .map((id) => branches.find((item) => item.id === id)?.name)
                          .filter(Boolean)
                          .join('، ')
                      : copy('All branches selected')}
                  </dd>
                </div>
                <div>
                  <dt>{copy('Terms and conditions')}</dt>
                  <dd>{selected.terms || copy('No terms added')}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="discount-empty">
              {loading ? copy('Loading discounts...') : copy('No matching discounts.')}
            </p>
          )}
        </aside>

        <section className="discount-list-card" aria-labelledby="discount-list-heading">
          <div className="discount-list-heading">
            <div>
              <h2 id="discount-list-heading">{copy('Discount list')}</h2>
              <p>
                {formatNumber(visibleDiscounts.length)} {copy('discounts')}
              </p>
            </div>
          </div>
          <div className="discount-table" role="table">
            <div className="discount-table-head" role="row">
              {['Name', 'Code', 'Type', 'Value', 'Usage', 'Status', 'Actions'].map((heading) => (
                <span role="columnheader" key={heading}>
                  {copy(heading)}
                </span>
              ))}
            </div>
            <div className="discount-table-body">
              {visibleDiscounts.map((discount) => (
                <Button
                  className={`discount-row ${selected?.id === discount.id ? 'selected' : ''}`}
                  variant="ghost"
                  size="sm"
                  type="button"
                  role="row"
                  key={discount.id}
                  onClick={() => setSelectedId(discount.id)}
                >
                  <span className="discount-name-cell">
                    <i className={`discount-row-icon ${discount.tone}`}>
                      <Icon name={discount.icon} />
                    </i>
                    <span>
                      <strong>{copy(discount.name)}</strong>
                      <small>{copy(discount.description)}</small>
                    </span>
                  </span>
                  <code>{discount.code}</code>
                  <span>
                    <em className={`discount-type ${discount.type}`}>
                      {copy(typeLabel(discount.type))}
                    </em>
                  </span>
                  <strong dir="ltr">
                    {amount(discount.value, locale)}
                    {discount.type === 'percentage' ? '%' : ' EGP'}
                  </strong>
                  <span className="discount-usage" dir="ltr">
                    {formatNumber(discount.redemptions)} /{' '}
                    {discount.usageLimit ? formatNumber(Number(discount.usageLimit)) : '∞'}
                  </span>
                  <span className={`discount-status ${discount.status}`}>
                    <i /> {copy(statusLabel(discount.status))}
                  </span>
                  <span className="discount-row-actions" aria-hidden="true">
                    •••
                  </span>
                </Button>
              ))}
            </div>
          </div>
          {!visibleDiscounts.length && (
            <p className="discount-empty">
              {loading ? copy('Loading discounts...') : copy('No matching discounts.')}
            </p>
          )}
          <div className="discount-pagination" aria-label="Pagination">
            <Button
              className="discount-refresh-button"
              variant="ghost"
              size="icon"
              type="button"
              aria-label={copy('Refresh discounts')}
              disabled={loading}
              onClick={() => void reload()}
            >
              <Icon name="refresh" />
            </Button>
            <span>
              {copy('Showing')} {formatNumber(visibleDiscounts.length)} {copy('of')}{' '}
              {formatNumber(stats.totalCoupons)}
            </span>
          </div>
        </section>
      </div>
      {editorOpen && (
        <DiscountEditor
          discount={editing}
          discounts={discounts}
          branches={branches}
          busy={busy}
          submitError={error}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
            setError('');
          }}
          onSave={saveDiscount}
        />
      )}
    </div>
  );
}
