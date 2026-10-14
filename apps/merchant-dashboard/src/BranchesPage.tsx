import { useMemo, useState } from 'react';
import { useLocale } from '@waffarly/ui';
import { Icon } from './Icons.js';
import { branchesCopy } from './branches-copy.js';

type BranchStatus = 'active' | 'inactive';
type BranchArea = 'Cairo' | 'Giza';

type Branch = {
  id: string;
  name: string;
  area: string;
  city: BranchArea;
  orders: number;
  averageOrder: string;
  trend: string;
  status: BranchStatus;
  address: string;
  hours: string;
  phone: string;
  rating: number;
  todayOrders: number;
  image: string;
};

const restaurantImage =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80';
const restaurantImageAlt =
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80';

const branches: Branch[] = [
  {
    id: 'zamalek', name: 'Zamalek Branch', area: 'Zamalek', city: 'Cairo', orders: 428,
    averageOrder: '145.50', trend: '12%', status: 'active', address: '26 July Street, Zamalek, Cairo',
    hours: '9:00 AM - 12:00 AM', phone: '0111 234 5678', rating: 48, todayOrders: 86, image: restaurantImage,
  },
  {
    id: 'maadi', name: 'Maadi Branch', area: 'Maadi', city: 'Cairo', orders: 312,
    averageOrder: '138.20', trend: '28%', status: 'active', address: 'Road 9, Maadi, Cairo',
    hours: '9:00 AM - 12:00 AM', phone: '0112 345 6789', rating: 46, todayOrders: 64, image: restaurantImageAlt,
  },
  {
    id: 'nasr-city', name: 'Nasr City Branch', area: 'Nasr City', city: 'Cairo', orders: 286,
    averageOrder: '152.30', trend: '16%', status: 'active', address: 'Makram Ebeid Street, Nasr City, Cairo',
    hours: '10:00 AM - 1:00 AM', phone: '0109 876 5432', rating: 45, todayOrders: 52, image: restaurantImage,
  },
  {
    id: 'october', name: 'October Branch', area: '6 October', city: 'Giza', orders: 198,
    averageOrder: '140.75', trend: '9%', status: 'active', address: 'Mall of Egypt Road, 6 October, Giza',
    hours: '10:00 AM - 1:00 AM', phone: '0106 555 1212', rating: 43, todayOrders: 41, image: restaurantImageAlt,
  },
  {
    id: 'fifth-settlement', name: 'Fifth Settlement Branch', area: 'Fifth Settlement', city: 'Cairo', orders: 24,
    averageOrder: '110.00', trend: '62%', status: 'inactive', address: 'North 90th Street, Fifth Settlement, Cairo',
    hours: '9:00 AM - 12:00 AM', phone: '0101 234 5678', rating: 39, todayOrders: 0, image: restaurantImage,
  },
];

const statusLabels: Record<BranchStatus, string> = { active: 'Active', inactive: 'Inactive' };

function BranchStatusBadge({ status, copy }: { status: BranchStatus; copy: (text: string) => string }) {
  return <span className={`branch-status branch-status-${status}`}><i />{copy(statusLabels[status])}</span>;
}

export function BranchesPage() {
  const { locale, t, formatNumber } = useLocale();
  const copy = (message: string) => branchesCopy(message, locale, t);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | BranchStatus>('all');
  const [area, setArea] = useState<'all' | BranchArea>('all');
  const [selectedId, setSelectedId] = useState('zamalek');
  const [notice, setNotice] = useState('');

  const filteredBranches = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return branches.filter((branch) => {
      const matchesQuery = !normalizedQuery || [branch.name, branch.area, branch.address].some((value) => value.toLocaleLowerCase(locale).includes(normalizedQuery));
      return matchesQuery && (status === 'all' || branch.status === status) && (area === 'all' || branch.city === area);
    });
  }, [area, locale, query, status]);

  const selectedBranch = branches.find((branch) => branch.id === selectedId) ?? branches[0]!;

  function selectBranch(branch: Branch) {
    setSelectedId(branch.id);
    setNotice('');
  }

  return (
    <section className="branches-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="branches-page-heading">
        <div>
          <h1>{copy('Branches')}</h1>
          <p>{copy('Manage your branches, track their performance, and keep every location up to date.')}</p>
        </div>
        <button type="button" className="branches-add-button" onClick={() => setNotice(copy('Branch details are ready to edit.'))}><Icon name="plus" />{copy('Add branch')}</button>
      </div>

      <div className="branches-stat-grid" aria-label={copy('Branches')}>
        <article className="branches-stat"><div className="branches-stat-inner cream"><div><span>{copy('Total branches')}</span><strong dir="ltr">{formatNumber(5)}</strong><small className="branch-positive" dir="ltr">↑ {formatNumber(25)}% <em>{copy('vs. last month')}</em></small></div><span className="branches-stat-icon"><Icon name="branches" /></span></div></article>
        <article className="branches-stat"><div className="branches-stat-inner mint"><div><span>{copy('Active branches')}</span><strong dir="ltr">{formatNumber(4)}</strong><small className="branch-positive" dir="ltr">↑ {formatNumber(33)}% <em>{copy('vs. last month')}</em></small></div><span className="branches-stat-icon"><Icon name="check" /></span></div></article>
        <article className="branches-stat"><div className="branches-stat-inner blue"><div><span>{copy('Inactive branches')}</span><strong dir="ltr">{formatNumber(1)}</strong><small dir="ltr">{formatNumber(0)}% <em>{copy('vs. last month')}</em></small></div><span className="branches-stat-icon"><Icon name="pause" /></span></div></article>
        <article className="branches-stat"><div className="branches-stat-inner lavender"><div><span>{copy('Total orders')}</span><strong dir="ltr">{formatNumber(1248)}</strong><small className="branch-positive" dir="ltr">↑ {formatNumber(18)}% <em>{copy('vs. last month')}</em></small></div><span className="branches-stat-icon"><Icon name="orders" /></span></div></article>
      </div>

      {notice && <div className="branches-notice" role="status">{notice}</div>}

      <div className="branches-content-grid">
        <aside className="branch-details-card" aria-labelledby="branch-details-title">
          <div className="branch-details-heading"><h2 id="branch-details-title">{copy('Branch details')}</h2><button type="button" className="branch-icon-button" aria-label={copy('Edit branch')} onClick={() => setNotice(copy('Branch details are ready to edit.'))}><Icon name="edit" /></button></div>
          <div className="branch-hero"><img src={selectedBranch.image} alt="" /><BranchStatusBadge status={selectedBranch.status} copy={copy} /></div>
          <div className="branch-detail-title"><div><h3>{copy(selectedBranch.name)}</h3><span><Icon name="location" />{copy(selectedBranch.area)}, {copy(selectedBranch.city)}</span></div><span className="branch-store-icon"><Icon name="store" /></span></div>
          <div className="branch-detail-metrics"><div><span>{copy("Today's orders")}</span><strong dir="ltr">{formatNumber(selectedBranch.todayOrders)}</strong><Icon name="orders" /></div><div><span>{copy('Average order value')}</span><strong dir="ltr">EGP {formatNumber(Number(selectedBranch.averageOrder), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><Icon name="revenue" /></div><div><span>{copy('Rating')}</span><strong dir="ltr">{formatNumber(selectedBranch.rating)}</strong><Icon name="star" /></div></div>
          <dl className="branch-detail-list"><div><dt><Icon name="location" />{copy('Location')}</dt><dd>{copy(selectedBranch.city)}</dd></div><div><dt><Icon name="mapPin" />{copy('Address')}</dt><dd>{copy(selectedBranch.address)}</dd></div><div><dt><Icon name="clock" />{copy('Opening hours')}</dt><dd dir="ltr">{copy(selectedBranch.hours)}</dd></div><div><dt><Icon name="phone" />{copy('Phone')}</dt><dd dir="ltr">{copy(selectedBranch.phone)}</dd></div></dl>
          <div className="branch-map" aria-label={`${copy('Location')}: ${copy(selectedBranch.area)}`}><span className="branch-map-label branch-map-label-one">{copy(selectedBranch.area)}</span><span className="branch-map-label branch-map-label-two">{copy(selectedBranch.city)}</span><span className="branch-map-road road-one" /><span className="branch-map-road road-two" /><span className="branch-map-pin"><Icon name="location" /></span></div>
          <button type="button" className="branch-edit-button" onClick={() => setNotice(copy('Branch details are ready to edit.'))}>{copy('Edit branch details')} <Icon name="edit" /></button>
        </aside>

        <section className="branches-list-card" aria-labelledby="branch-list-title">
          <div className="branches-list-heading"><div><h2 id="branch-list-title">{copy('Branch directory')}</h2><p>{copy('View and manage all branches in your store.')}</p></div></div>
          <div className="branches-toolbar" role="search"><label className="branches-search"><Icon name="search" /><span className="sr-only">{copy('Search branches...')}</span><input aria-label={copy('Search branches...')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy('Search branches...')} /></label><label className="branch-select"><span className="sr-only">{copy('All statuses')}</span><select aria-label={copy('All statuses')} value={status} onChange={(event) => setStatus(event.target.value as 'all' | BranchStatus)}><option value="all">{copy('All statuses')}</option><option value="active">{copy('Active')}</option><option value="inactive">{copy('Inactive')}</option></select><Icon name="chevron" /></label><label className="branch-select"><span className="sr-only">{copy('All areas')}</span><select aria-label={copy('All areas')} value={area} onChange={(event) => setArea(event.target.value as 'all' | BranchArea)}><option value="all">{copy('All areas')}</option><option value="Cairo">{copy('Cairo')}</option><option value="Giza">{copy('Giza')}</option></select><Icon name="chevron" /></label></div>
          <div className="branches-table" role="table" aria-rowcount={filteredBranches.length}><div className="branches-table-head" role="row"><span role="columnheader">{copy('Branch')}</span><span role="columnheader">{copy('Area')}</span><span role="columnheader">{copy('Orders')}</span><span role="columnheader">{copy('Average order value')}</span><span role="columnheader">{copy('Status')}</span><span role="columnheader">{copy('Actions')}</span></div><div className="branches-table-body">{filteredBranches.map((branch) => <button type="button" role="row" className={`branches-row ${selectedBranch.id === branch.id ? 'is-selected' : ''}`} key={branch.id} onClick={() => selectBranch(branch)}><span role="cell" className="branch-name-cell"><img src={branch.image} alt="" loading="lazy" /><span><strong>{copy(branch.name)}</strong><small><Icon name="location" />{copy(branch.address)}</small></span></span><span role="cell" className="branch-area-cell"><strong>{copy(branch.area)}</strong><small>{copy(branch.city)}</small></span><span role="cell" className="branch-orders-cell"><strong dir="ltr">{formatNumber(branch.orders)}</strong><small className={branch.status === 'inactive' ? 'branch-negative' : 'branch-positive'} dir="ltr">{branch.status === 'inactive' ? '↓' : '↑'} {copy(branch.trend)}</small></span><span role="cell" className="branch-average-cell" dir="ltr">EGP {formatNumber(Number(branch.averageOrder), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><span role="cell"><BranchStatusBadge status={branch.status} copy={copy} /></span><span role="cell" className="branch-row-actions" aria-label={`${copy('Actions')} ${copy(branch.name)}`}>•••</span></button>)}{filteredBranches.length === 0 && <div className="branches-empty"><Icon name="branches" /><strong>{copy('No branches found.')}</strong><span>{copy('Try changing your search or filters.')}</span></div>}</div></div>
          <div className="branches-pagination"><span>{copy('Showing 5 of 5 branches')}</span><div><button type="button" aria-label={copy('Previous page')}>‹</button><button type="button" className="is-current" aria-current="page">{formatNumber(1)}</button><button type="button">{formatNumber(2)}</button><button type="button" aria-label={copy('Next page')}>›</button></div></div>
        </section>
      </div>
    </section>
  );
}
