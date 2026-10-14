import { useMemo, useState } from 'react';
import { useLocale } from '@waffarly/ui';
import { Icon } from './Icons.js';

type CustomerStatus = 'active' | 'vip' | 'new' | 'inactive';
type CustomerSegment = 'all' | 'regular' | 'vip' | 'new';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  orders: number;
  lastOrder: string;
  lastOrderTime: string;
  spend: string;
  status: CustomerStatus;
  segment: Exclude<CustomerSegment, 'all'>;
  joined: string;
  city: string;
  note: string;
  avatarTone: 'blue' | 'purple' | 'mint' | 'orange';
};

const customers: Customer[] = [
  { id: 'mohamed-ali', name: 'Mohamed Ali', phone: '0122 345 6789', email: 'mohamed.ali@example.com', orders: 12, lastOrder: '20 October 2024', lastOrderTime: '03:24 PM', spend: 'EGP 1,250.00', status: 'active', segment: 'regular', joined: '12 August 2024', city: 'Cairo', note: 'Customer prefers chicken and family-sized meals.', avatarTone: 'blue' },
  { id: 'sarah-ahmed', name: 'Sarah Ahmed', phone: '0100 987 6543', email: 'sarah.ahmed@example.com', orders: 8, lastOrder: '18 October 2024', lastOrderTime: '01:15 PM', spend: 'EGP 980.50', status: 'active', segment: 'regular', joined: '04 July 2024', city: 'Giza', note: 'Usually orders during the afternoon.', avatarTone: 'purple' },
  { id: 'ahmed-mahmoud', name: 'Ahmed Mahmoud', phone: '0111 222 3333', email: 'ahmed.mahmoud@example.com', orders: 24, lastOrder: '19 October 2024', lastOrderTime: '11:10 AM', spend: 'EGP 2,430.00', status: 'vip', segment: 'vip', joined: '22 March 2024', city: 'Cairo', note: 'High-value customer. Offer early access to new products.', avatarTone: 'mint' },
  { id: 'manal-ibrahim', name: 'Manal Ibrahim', phone: '0155 666 7777', email: 'manal.ibrahim@example.com', orders: 5, lastOrder: '17 October 2024', lastOrderTime: '07:45 PM', spend: 'EGP 640.00', status: 'active', segment: 'regular', joined: '29 June 2024', city: 'Cairo', note: 'No saved notes yet.', avatarTone: 'orange' },
  { id: 'karem-salem', name: 'Karem Salem', phone: '0109 888 9999', email: 'karem.salem@example.com', orders: 3, lastOrder: '16 October 2024', lastOrderTime: '05:10 PM', spend: 'EGP 320.00', status: 'inactive', segment: 'regular', joined: '03 October 2024', city: 'Giza', note: 'Customer has not ordered in the last two weeks.', avatarTone: 'blue' },
  { id: 'zainab-khaled', name: 'Zainab Khaled', phone: '0127 123 4567', email: 'zainab.khaled@example.com', orders: 18, lastOrder: '19 October 2024', lastOrderTime: '02:20 PM', spend: 'EGP 1,880.00', status: 'active', segment: 'regular', joined: '11 April 2024', city: 'Cairo', note: 'Loyal customer with frequent repeat orders.', avatarTone: 'purple' },
  { id: 'omar-youssef', name: 'Omar Youssef', phone: '0110 555 6666', email: 'omar.youssef@example.com', orders: 1, lastOrder: '15 October 2024', lastOrderTime: '09:00 AM', spend: 'EGP 160.00', status: 'new', segment: 'new', joined: '15 October 2024', city: 'Cairo', note: 'New customer. Consider sending a welcome offer.', avatarTone: 'mint' },
  { id: 'fatma-mohamed', name: 'Fatma Mohamed', phone: '0128 444 3333', email: 'fatma.mohamed@example.com', orders: 9, lastOrder: '18 October 2024', lastOrderTime: '09:30 AM', spend: 'EGP 950.00', status: 'active', segment: 'regular', joined: '07 May 2024', city: 'Cairo', note: 'Prefers delivery to the Zamalek area.', avatarTone: 'orange' },
  { id: 'yasser-tarek', name: 'Yasser Tarek', phone: '0101 777 8888', email: 'yasser.tarek@example.com', orders: 28, lastOrder: '20 October 2024', lastOrderTime: '12:05 PM', spend: 'EGP 3,120.00', status: 'vip', segment: 'vip', joined: '18 January 2024', city: 'Cairo', note: 'Top customer this month.', avatarTone: 'blue' },
  { id: 'nourhan-ali', name: 'Nourhan Ali', phone: '0114 999 0000', email: 'nourhan.ali@example.com', orders: 6, lastOrder: '18 October 2024', lastOrderTime: '08:17 AM', spend: 'EGP 780.00', status: 'active', segment: 'regular', joined: '14 June 2024', city: 'Giza', note: 'No saved notes yet.', avatarTone: 'purple' },
];

const statusLabels: Record<CustomerStatus, string> = { active: 'Active', vip: 'VIP', new: 'New', inactive: 'Inactive' };
const segmentLabels: Record<Exclude<CustomerSegment, 'all'>, string> = { regular: 'Regular customers', vip: 'VIP customers', new: 'New customers' };
const defaultCustomer = customers[0]!;

function CustomerAvatar({ customer, large = false }: { customer: Customer; large?: boolean }) {
  return <span className={`customer-avatar customer-avatar-${customer.avatarTone} ${large ? 'large' : ''}`}><Icon name="customers" /></span>;
}

export function CustomersPage() {
  const { t, formatNumber, formatDigits } = useLocale();
  const formatSpend = (spend: string) => {
    const amount = Number(spend.replace(/^EGP\s*/, '').replace(/,/g, ''));
    return `EGP ${formatNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | CustomerStatus>('all');
  const [segment, setSegment] = useState<CustomerSegment>('all');
  const [selectedId, setSelectedId] = useState(defaultCustomer.id);
  const [selectedRows, setSelectedRows] = useState<string[]>([defaultCustomer.id]);
  const [note, setNote] = useState(defaultCustomer.note);
  const [noteSaved, setNoteSaved] = useState(false);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return customers.filter((customer) => {
      const matchesQuery = !normalizedQuery || [customer.name, customer.phone, customer.email].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      return matchesQuery && (status === 'all' || customer.status === status) && (segment === 'all' || customer.segment === segment);
    });
  }, [query, segment, status]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedId) ?? defaultCustomer;

  function selectCustomer(customer: Customer) {
    setSelectedId(customer.id);
    setNote(customer.note);
    setNoteSaved(false);
  }

  function toggleRow(id: string) {
    setSelectedRows((current) => current.includes(id) ? current.filter((rowId) => rowId !== id) : [...current, id]);
  }

  function toggleAllRows() {
    setSelectedRows((current) => current.length === filteredCustomers.length ? [] : filteredCustomers.map((customer) => customer.id));
  }

  return (
    <section className="customers-page" aria-labelledby="customers-workspace-title">
      <h2 id="customers-workspace-title" className="sr-only">{t('Customer directory')}</h2>

      <div className="customers-stats" aria-label={t('Customer summary')}>
        <article className="customers-stat customers-stat-new"><span className="customers-stat-icon"><Icon name="customers" /></span><div><span>{t('New customers')}</span><strong>{formatNumber(42)}</strong><small className="customers-positive">↑ {formatNumber(35)}% <em>{t('vs. last month')}</em></small></div></article>
        <article className="customers-stat customers-stat-blue"><span className="customers-stat-icon"><Icon name="customers" /></span><div><span>{t('Total customers')}</span><strong>{formatNumber(1240)}</strong><small className="customers-positive">↑ {formatNumber(12)}% <em>{t('vs. last month')}</em></small></div></article>
        <article className="customers-stat customers-stat-gold"><span className="customers-stat-icon"><Icon name="receipt" /></span><div><span>{t('Average orders')}</span><strong>{formatNumber(3.2, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong><small className="customers-positive">↑ {formatNumber(18)}% <em>{t('vs. last month')}</em></small></div></article>
        <article className="customers-stat customers-stat-green"><span className="customers-stat-icon"><Icon name="revenue" /></span><div><span>{t('Average customer spend')}</span><strong>EGP {formatNumber(280.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small className="customers-positive">↑ {formatNumber(22)}% <em>{t('vs. last month')}</em></small></div></article>
      </div>

      <div className="customers-toolbar" role="search">
        <button type="button" className="customers-bulk-action" disabled={selectedRows.length === 0} onClick={() => setSelectedRows([])}><Icon name="trash" />{t('Bulk actions')}<span>{formatNumber(selectedRows.length)}</span></button>
        <label className="customers-select-field"><span className="sr-only">{t('Customer segment')}</span><select aria-label={t('Customer segment')} value={segment} onChange={(event) => setSegment(event.target.value as CustomerSegment)}><option value="all">{t('All segments')}</option>{(Object.keys(segmentLabels) as Array<Exclude<CustomerSegment, 'all'>>).map((key) => <option key={key} value={key}>{t(segmentLabels[key])}</option>)}</select><Icon name="chevron" /></label>
        <label className="customers-select-field"><span className="sr-only">{t('Customer status')}</span><select aria-label={t('Customer status')} value={status} onChange={(event) => setStatus(event.target.value as 'all' | CustomerStatus)}><option value="all">{t('All statuses')}</option>{(Object.keys(statusLabels) as CustomerStatus[]).map((key) => <option key={key} value={key}>{t(statusLabels[key])}</option>)}</select><Icon name="chevron" /></label>
        <label className="customers-select-field"><span className="sr-only">{t('Order count')}</span><select aria-label={t('Order count')} defaultValue="all"><option value="all">{t('All order counts')}</option><option value="high">{t('More than 10 orders')}</option><option value="low">{t('Less than 10 orders')}</option></select><Icon name="chevron" /></label>
        <label className="customers-search-field"><Icon name="search" /><input aria-label={t('Search customers')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search by customer name or phone...')} />{query && <button type="button" aria-label={t('Clear search')} onClick={() => setQuery('')}><Icon name="close" /></button>}</label>
      </div>

      <div className="customers-workspace">
        <section className="customers-table-card" aria-labelledby="customers-table-title">
          <div className="customers-table-heading"><div><h3 id="customers-table-title">{t('All customers')}</h3><p>{t('View and manage every customer in your store.')}</p></div><button type="button" className="customers-export-button" onClick={() => undefined}><Icon name="download" />{t('Export')}</button></div>
          <div className="customers-table-scroll">
            <div className="customers-table" role="table" aria-rowcount={filteredCustomers.length}>
              <div className="customers-table-row customers-table-header" role="row"><span role="columnheader" className="customers-checkbox-cell"><input type="checkbox" aria-label={t('Select all customers')} checked={filteredCustomers.length > 0 && selectedRows.length === filteredCustomers.length} onChange={toggleAllRows} /></span><span role="columnheader">{t('Customer')}</span><span role="columnheader">{t('Phone')}</span><span role="columnheader">{t('Orders')}</span><span role="columnheader">{t('Last order')}</span><span role="columnheader">{t('Total spend')}</span><span role="columnheader">{t('Status')}</span></div>
              {filteredCustomers.map((customer) => <button type="button" role="row" className={`customers-table-row customers-table-body-row ${selectedCustomer.id === customer.id ? 'is-selected' : ''}`} key={customer.id} onClick={() => selectCustomer(customer)}><span role="cell" className="customers-checkbox-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`${t('Select')} ${t(customer.name)}`} checked={selectedRows.includes(customer.id)} onChange={() => toggleRow(customer.id)} /></span><span role="cell" className="customers-name-cell"><CustomerAvatar customer={customer} /><strong>{t(customer.name)}</strong></span><span role="cell" className="customers-phone-cell" dir="ltr">{formatDigits(customer.phone)}</span><span role="cell" className="customers-orders-cell">{formatNumber(customer.orders)}</span><span role="cell" className="customers-date-cell"><span>{t(customer.lastOrder)}</span><small>{t(customer.lastOrderTime)}</small></span><span role="cell" className="customers-spend-cell" dir="ltr">{formatSpend(customer.spend)}</span><span role="cell"><span className={`customer-status customer-status-${customer.status}`}><i /> {t(statusLabels[customer.status])}</span></span></button>)}
              {filteredCustomers.length === 0 && <div className="customers-empty-state"><Icon name="customers" /><strong>{t('No customers found')}</strong><span>{t('Try changing your filters or search phrase.')}</span></div>}
            </div>
          </div>
          <div className="customers-pagination"><span>{t('Showing {{count}} of {{total}} customers', { count: filteredCustomers.length, total: customers.length })}</span><div><button type="button" className="is-current" aria-current="page">{formatNumber(1)}</button><button type="button">{formatNumber(2)}</button><button type="button">{formatNumber(3)}</button><button type="button" aria-label={t('Next page')}><Icon name="arrow" /></button></div></div>
        </section>

        <aside className="customer-detail-card" aria-labelledby="customer-detail-title">
          <div className="customer-detail-actions"><button type="button" aria-label={t('Close customer details')} onClick={() => undefined}><Icon name="close" /></button><button type="button" aria-label={t('More customer actions')} onClick={() => undefined}><Icon name="more" /></button></div>
          <div className="customer-detail-profile"><CustomerAvatar customer={selectedCustomer} large /><h3 id="customer-detail-title">{t(selectedCustomer.name)}</h3><span className={`customer-status customer-status-${selectedCustomer.status}`}><i /> {t(statusLabels[selectedCustomer.status])}</span><a href={`tel:${selectedCustomer.phone}`} dir="ltr"><Icon name="phone" /> {selectedCustomer.phone}</a><a href={`mailto:${selectedCustomer.email}`}><Icon name="mail" /> {selectedCustomer.email}</a><span><Icon name="calendar" /> {t('Joined')} {t(selectedCustomer.joined)}</span></div>
          <div className="customer-detail-metrics"><div><span>{t('Orders')}</span><strong>{formatNumber(selectedCustomer.orders)}</strong></div><div><span>{t('Total spend')}</span><strong dir="ltr">{formatSpend(selectedCustomer.spend)}</strong></div></div>
          <div className="customer-detail-section"><h4>{t('Additional information')}</h4><dl><div><dt>{t('Segment')}</dt><dd>{t(segmentLabels[selectedCustomer.segment])}</dd></div><div><dt>{t('Location')}</dt><dd>{t(selectedCustomer.city)}</dd></div><div><dt>{t('Last order')}</dt><dd>{t(selectedCustomer.lastOrder)}</dd></div></dl></div>
          <div className="customer-detail-section customer-notes-section"><h4>{t('Notes')}</h4><label><span className="sr-only">{t('Customer notes')}</span><textarea value={t(note)} onChange={(event) => { setNote(event.target.value); setNoteSaved(false); }} /></label></div>
          <button type="button" className="customer-save-note" onClick={() => setNoteSaved(true)}>{noteSaved ? t('Saved') : t('Save note')}<Icon name="send" /></button>
        </aside>
      </div>
    </section>
  );
}
