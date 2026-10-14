import { useMemo, useState, type FormEvent } from 'react';
import { useLocale } from '@waffarly/ui';
import { Icon } from './Icons.js';
import { discountsCopy } from './discounts-copy.js';

type DiscountStatus = 'active' | 'scheduled' | 'draft' | 'expired';
type DiscountType = 'percentage' | 'fixed';

type Discount = {
  id: string;
  name: string;
  description: string;
  code: string;
  type: DiscountType;
  value: string;
  usage: string;
  status: DiscountStatus;
  icon: string;
  tone: 'pink' | 'orange' | 'blue' | 'green' | 'purple';
  minimum: string;
  maximum: string;
  dates: string;
  excluded: string;
};

const discounts: Discount[] = [
  {
    id: 'welcome20',
    name: 'Welcome discount',
    description: '20% off your first order',
    code: 'WELCOME20',
    type: 'percentage',
    value: '20%',
    usage: '432 / 500',
    status: 'active',
    icon: 'gift',
    tone: 'pink',
    minimum: 'EGP 100',
    maximum: 'EGP 50',
    dates: '1 April 2024 – 31 December 2024',
    excluded: 'No excluded products',
  },
  {
    id: 'food50',
    name: 'Weekend special',
    description: '50 EGP off orders',
    code: 'FOOD50',
    type: 'fixed',
    value: '35 EGP',
    usage: '862 / 1,000',
    status: 'active',
    icon: 'ticket',
    tone: 'orange',
    minimum: 'EGP 150',
    maximum: 'EGP 35',
    dates: '1 June 2024 – 30 June 2024',
    excluded: 'No excluded products',
  },
  {
    id: 'summer15',
    name: 'Summer sale',
    description: '15% off all products',
    code: 'SUMMER15',
    type: 'percentage',
    value: '15%',
    usage: '0 / 300',
    status: 'scheduled',
    icon: 'sun',
    tone: 'orange',
    minimum: 'EGP 200',
    maximum: 'EGP 75',
    dates: '15 June 2024 – 15 July 2024',
    excluded: 'No excluded products',
  },
  {
    id: 'new30',
    name: 'New customer discount',
    description: '30 EGP off for new customers',
    code: 'NEW30',
    type: 'fixed',
    value: '30 EGP',
    usage: '0 / 0',
    status: 'draft',
    icon: 'userPlus',
    tone: 'blue',
    minimum: 'EGP 120',
    maximum: 'EGP 30',
    dates: '1 June 2024 – 30 June 2024',
    excluded: 'No excluded products',
  },
  {
    id: 'ramadan25',
    name: 'Ramadan offer',
    description: '25% off during Ramadan',
    code: 'RAMADAN25',
    type: 'percentage',
    value: '25%',
    usage: '621 / 800',
    status: 'active',
    icon: 'moon',
    tone: 'purple',
    minimum: 'EGP 150',
    maximum: 'EGP 100',
    dates: '1 March 2024 – 31 March 2024',
    excluded: 'No excluded products',
  },
  {
    id: 'eid40',
    name: 'Eid offer',
    description: '40 EGP off Eid orders',
    code: 'EID40',
    type: 'fixed',
    value: '40 EGP',
    usage: '1,245 / 1,200',
    status: 'expired',
    icon: 'gift',
    tone: 'pink',
    minimum: 'EGP 200',
    maximum: 'EGP 40',
    dates: '1 May 2024 – 31 May 2024',
    excluded: 'No excluded products',
  },
  {
    id: 'save10',
    name: 'Save more',
    description: '10% off all products',
    code: 'SAVE10',
    type: 'percentage',
    value: '10%',
    usage: '120 / 300',
    status: 'active',
    icon: 'tag',
    tone: 'orange',
    minimum: 'EGP 100',
    maximum: 'EGP 50',
    dates: '1 June 2024 – 31 August 2024',
    excluded: 'No excluded products',
  },
  {
    id: 'big75',
    name: 'Big order discount',
    description: '75 EGP off large orders',
    code: 'BIG75',
    type: 'fixed',
    value: '75 EGP',
    usage: '0 / 500',
    status: 'scheduled',
    icon: 'percent',
    tone: 'pink',
    minimum: 'EGP 500',
    maximum: 'EGP 75',
    dates: '1 July 2024 – 31 July 2024',
    excluded: 'No excluded products',
  },
];

const statCards = [
  {
    label: 'Total discount value',
    value: 'EGP 24,850.00',
    change: '12%',
    icon: 'database',
    tone: 'mint',
  },
  { label: 'Active coupons', value: '6', change: '20%', icon: 'ticket', tone: 'cream' },
  { label: 'Customers reached', value: '1,289', change: '24%', icon: 'customers', tone: 'blue' },
  { label: 'Total redemptions', value: '3,842', change: '18%', icon: 'tag', tone: 'lavender' },
] as const;

function statusLabel(status: DiscountStatus) {
  return status === 'active'
    ? 'Active'
    : status === 'scheduled'
      ? 'Scheduled'
      : status === 'draft'
        ? 'Draft'
        : 'Expired';
}

function typeLabel(type: DiscountType) {
  return type === 'percentage' ? 'Percentage discount' : 'Fixed discount';
}

export function DiscountsPage() {
  const { t, locale, formatNumber } = useLocale();
  const copy = (message: string) => discountsCopy(message, locale, t);
  const formatNumericText = (value: string) =>
    value.replace(/\d+(?:,\d{3})*(?:\.\d+)?/g, (digits) => {
      const fractionDigits = digits.split('.')[1]?.length ?? 0;
      return formatNumber(Number(digits.replace(/,/g, '')), {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
    });
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState('welcome20');
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const visibleDiscounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return discounts.filter((discount) => {
      const matchesQuery =
        !normalizedQuery ||
        `${copy(discount.name)} ${copy(discount.description)} ${discount.code}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesType = type === 'all' || discount.type === type;
      const matchesStatus = status === 'all' || discount.status === status;
      return matchesQuery && matchesType && matchesStatus && branch === 'all';
    });
  }, [branch, copy, query, status, type]);

  const selected = discounts.find((discount) => discount.id === selectedId) ?? discounts[0]!;

  function showNotice(message: string) {
    setNotice(copy(message));
    window.setTimeout(() => setNotice(''), 2200);
  }

  function createDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateOpen(false);
    showNotice('Discount created');
  }

  return (
    <div className="discounts-page">
      <div className="discounts-page-heading">
        <div>
          <h1>{copy('Discounts')}</h1>
          <p>{copy('Manage coupons and promotional offers to increase your sales.')}</p>
        </div>
        <button
          className="discounts-create-button"
          type="button"
          onClick={() => setCreateOpen(true)}
        >
          <Icon name="plus" /> {copy('Create discount')}
        </button>
      </div>

      <div className="discounts-stat-grid" aria-label={copy('Discounts')}>
        {statCards.map((stat) => (
          <article className="discount-stat" key={stat.label}>
            <div className={`discount-stat-inner ${stat.tone}`}>
              <span className="discount-stat-icon">
                <Icon name={stat.icon} />
              </span>
              <div className="discount-stat-copy">
                <span>{copy(stat.label)}</span>
                <strong dir="ltr">{formatNumericText(stat.value)}</strong>
                <small className="discount-growth" dir="ltr">
                  ↑ {formatNumericText(stat.change)}
                </small>
                <small>{copy('Compared to last month')}</small>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="discounts-toolbar">
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
            <option value="active">{copy('Active')}</option>
            <option value="scheduled">{copy('Scheduled')}</option>
            <option value="draft">{copy('Draft')}</option>
            <option value="expired">{copy('Expired')}</option>
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
            <option value="zamalek">{locale === 'ar' ? 'فرع الزمالك' : 'Zamalek Branch'}</option>
            <option value="nasr">{locale === 'ar' ? 'فرع مدينة نصر' : 'Nasr City Branch'}</option>
          </select>
          <Icon name="chevron" />
        </label>
      </div>

      {notice && (
        <div className="discounts-notice" role="status">
          {notice}
        </div>
      )}

      <div className="discounts-content-grid">
        <aside className="discount-details-card">
          <div className="discount-details-heading">
            <h2>{copy('Discount details')}</h2>
            <button
              className="discount-icon-button"
              type="button"
              aria-label={copy('Edit')}
              onClick={() => showNotice('Discount created')}
            >
              <Icon name="edit" />
            </button>
          </div>
          <div className={`discount-details-hero ${selected.tone}`}>
            <span className="discount-large-icon">
              <Icon name={selected.icon} />
            </span>
            <h3>{copy(selected.name)}</h3>
            <button
              className="discount-code-chip"
              type="button"
              onClick={() => showNotice('Code copied')}
              title={copy('Code copied')}
            >
              <code>{selected.code}</code>
              <Icon name="copy" />
            </button>
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
              <dd dir="ltr">{formatNumericText(selected.value)}</dd>
            </div>
            <div>
              <dt>{copy('Minimum order')}</dt>
              <dd dir="ltr">{formatNumericText(selected.minimum)}</dd>
            </div>
            <div>
              <dt>{copy('Maximum discount')}</dt>
            <dd dir="ltr">{formatNumericText(selected.maximum)}</dd>
            </div>
            <div>
              <dt>{copy('Date range')}</dt>
              <dd>{copy(selected.dates)}</dd>
            </div>
            <div>
              <dt>{copy('Usage limit')}</dt>
            <dd dir="ltr">{formatNumericText(selected.usage)}</dd>
            </div>
            <div>
              <dt>{copy('Branches')}</dt>
              <dd>{copy('All branches selected')}</dd>
            </div>
            <div>
              <dt>{copy('Excluded products')}</dt>
              <dd>{copy(selected.excluded)}</dd>
            </div>
          </dl>
          <button
            className="discount-terms-button"
            type="button"
            onClick={() => showNotice('Discount created')}
          >
            <span>{copy('View terms and conditions')}</span>
            <Icon name="file" />
          </button>
        </aside>

        <section className="discount-list-card" aria-labelledby="discount-list-heading">
          <div className="discount-list-heading">
            <div>
              <h2 id="discount-list-heading">{copy('Discount list')}</h2>
              <p>{copy('8 of 8 discounts')}</p>
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
                <button
                  className={`discount-row ${selected.id === discount.id ? 'selected' : ''}`}
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
                  <strong dir="ltr">{formatNumericText(discount.value)}</strong>
                  <span className="discount-usage" dir="ltr">
                    {formatNumericText(discount.usage)}
                  </span>
                  <span className={`discount-status ${discount.status}`}>
                    <i /> {copy(statusLabel(discount.status))}
                  </span>
                  <span className="discount-row-actions" aria-hidden="true">
                    •••
                  </span>
                </button>
              ))}
            </div>
          </div>
          {visibleDiscounts.length === 0 && (
            <p className="discount-empty">{copy('No matching discounts.')}</p>
          )}
          <div className="discount-pagination" aria-label="Pagination">
            <button type="button" aria-label="Previous page">
              ‹
            </button>
            <button className="active" type="button" aria-current="page">
              {formatNumber(1)}
            </button>
            <button type="button">{formatNumber(2)}</button>
            <button type="button" aria-label="Next page">
              ›
            </button>
          </div>
        </section>
      </div>

      {createOpen && (
        <div
          className="discount-modal-backdrop"
          role="presentation"
          onMouseDown={() => setCreateOpen(false)}
        >
          <form
            className="discount-modal"
            onSubmit={createDiscount}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="discount-modal-heading">
              <div>
                <span className="discounts-eyebrow">{copy('Discounts')}</span>
                <h2>{copy('Create a discount')}</h2>
              </div>
              <button
                type="button"
                className="discount-icon-button"
                onClick={() => setCreateOpen(false)}
                aria-label={t('Close')}
              >
                <Icon name="close" />
              </button>
            </div>
            <label>
              {copy('Discount name')}
              <input required placeholder={copy('Welcome discount')} />
            </label>
            <label>
              {copy('Discount code')}
              <input required dir="ltr" placeholder="WELCOME20" />
            </label>
            <div className="discount-modal-actions">
              <button type="button" className="secondary" onClick={() => setCreateOpen(false)}>
                {t('Cancel')}
              </button>
              <button type="submit">{copy('Create discount')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
