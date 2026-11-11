import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CursorPage, MerchantCustomer } from '@waffarly/contracts';
import { Button, Input, useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { CustomerDetails } from './CustomerDetails.js';
import { channelLabel } from './customer-copy.js';
import { useCustomerResource } from './use-customer-resource.js';
import './customers.css';

type CustomerStatusFilter = 'active' | 'archived' | 'all';

export function CustomersWorkspace({ globalSearch }: { globalSearch: string }) {
  const { locale, formatNumber } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const status: CustomerStatusFilter = ['active', 'archived', 'all'].includes(
    params.get('status') ?? '',
  )
    ? (params.get('status') as CustomerStatusFilter)
    : 'active';
  const cursors = params.getAll('page');
  const selectedId = params.get('customer');
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const query = new URLSearchParams({
    limit: '25',
    status,
    search: (search.trim() || globalSearch.trim()).slice(0, 120),
  });
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1)!);
  const {
    data: page,
    error,
    loading,
  } = useCustomerResource<CursorPage<MerchantCustomer>>(`/owner/customers?${query}`, refresh);

  function updateFilter(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('page');
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }
  function selectCustomer(id: string | null) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set('customer', id);
      else next.delete('customer');
      return next;
    });
  }
  function saved(customer: MerchantCustomer) {
    setNotice(text('Customer saved.', 'تم حفظ العميل.'));
    setRefresh((value) => value + 1);
    selectCustomer(customer.id);
  }

  return (
    <section
      className="customers-page customers-live"
      aria-label={text('Customer directory', 'دليل العملاء')}
    >
      <h2 className="sr-only">{text('Customer directory', 'دليل العملاء')}</h2>

      {notice && (
        <p className="customers-live-notice" role="status">
          {notice}
        </p>
      )}

      <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="customers-toolbar customers-live-toolbar" role="group" aria-label={text('Customer search and actions', 'البحث عن العملاء والإجراءات')}>
        <label className="customers-live-search">
          <span className="sr-only">{text('Search for a customer', 'البحث عن عميل')}</span>
          <div className="customers-search-field">
            <Icon name="search" />
            <Input
              type="search"
              aria-label={text('Search for a customer', 'البحث عن عميل')}
              value={search}
              maxLength={120}
              placeholder={text('Name, mobile or email', 'الاسم أو الموبايل أو البريد')}
              onChange={(event) => updateFilter('q', event.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label={text('Clear search', 'مسح البحث')}
                onClick={() => updateFilter('q', '')}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        </label>
        <label className="customers-live-status">
          <span className="sr-only">{text('Status', 'الحالة')}</span>
          <span className="customers-select-field">
            <select
              aria-label={text('Customer status', 'حالة العميل')}
              value={status}
              onChange={(event) => updateFilter('status', event.target.value)}
            >
              <option value="active">{text('Active customers', 'العملاء النشطون')}</option>
              <option value="archived">{text('Archived customers', 'العملاء المؤرشفون')}</option>
              <option value="all">{text('All customers', 'كل العملاء')}</option>
            </select>
            <Icon name="chevron" />
          </span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="customers-refresh-button"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {text('Refresh', 'تحديث')}
        </Button>
      </div>

      <div className={`customers-workspace ${selectedId ? 'has-selection' : ''}`}>
        <section className="customers-table-card" aria-labelledby="customers-table-title">
          <div className="customers-table-heading">
            <h3 id="customers-table-title">{text('Customers', 'العملاء')}</h3>
            <span>
              {loading
                ? text('Loading…', 'جاري التحميل…')
                : text(
                    `${page?.items.length ?? 0} on this page`,
                    `${formatNumber(page?.items.length ?? 0)} في الصفحة`,
                  )}
            </span>
          </div>
          <div className="customers-table-scroll">
            <div
              className="customers-table"
              role="table"
              aria-busy={loading}
              aria-label={text('Customers in your store', 'عملاء متجرك')}
            >
              <div className="customers-table-row customers-table-header" role="row">
                <span role="columnheader">{text('Customer', 'العميل')}</span>
                <span role="columnheader">{text('Mobile', 'الموبايل')}</span>
                <span role="columnheader">{text('First contact', 'أول قناة وصول')}</span>
                <span role="columnheader">{text('Segment', 'التصنيف')}</span>
                <span role="columnheader">{text('Status', 'الحالة')}</span>
              </div>
              {!loading &&
                !error &&
                page?.items.map((customer) => (
                  <div
                    role="row"
                    className={`customers-table-row customers-table-body-row ${selectedId === customer.id ? 'is-selected' : ''}`}
                    key={customer.id}
                  >
                    <span role="cell" className="customers-name-cell">
                      <button
                        type="button"
                        aria-pressed={selectedId === customer.id}
                        onClick={() => selectCustomer(customer.id)}
                      >
                        <span
                          className={`customer-avatar ${customer.segment === 'vip' ? 'customer-avatar-orange' : 'customer-avatar-blue'}`}
                        >
                          <Icon name="customers" />
                        </span>
                        <span className="customers-name-copy">
                          <strong>{customer.name}</strong>
                          <small>
                            {customer.email ?? text('No email recorded', 'لا يوجد بريد إلكتروني')}
                          </small>
                        </span>
                      </button>
                    </span>
                    <span role="cell" className="customers-phone-cell" dir="ltr">
                      {customer.phone ?? '—'}
                    </span>
                    <span role="cell" className="customers-first-channel">
                      {channelLabel(customer.firstChannel, locale)}
                    </span>
                    <span role="cell">
                      <span
                        className={`customers-live-segment ${customer.segment === 'vip' ? 'is-vip' : ''}`}
                      >
                        {customer.segment === 'vip' ? 'VIP' : text('Regular', 'عادي')}
                      </span>
                    </span>
                    <span role="cell">
                      <span
                        className={`customer-status ${customer.archivedAt ? 'customer-status-inactive' : 'customer-status-active'}`}
                      >
                        <i />
                        {customer.archivedAt ? text('Archived', 'مؤرشف') : text('Active', 'نشط')}
                      </span>
                    </span>
                  </div>
                ))}
              {loading && (
                <div className="customers-empty-state" role="status">
                  <strong>{text('Loading customers…', 'جاري تحميل العملاء…')}</strong>
                </div>
              )}
              {error && !loading && (
                <div className="customers-empty-state" role="alert">
                  <Icon name="customers" />
                  <strong>{text('Customers could not be loaded', 'تعذّر تحميل العملاء')}</strong>
                  <span>
                    {text('Check your connection and try again.', 'راجع الاتصال وحاول تاني.')}
                  </span>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    {text('Try again', 'إعادة المحاولة')}
                  </Button>
                </div>
              )}
              {!loading && !error && page?.items.length === 0 && (
                <div className="customers-empty-state" role="status">
                  <Icon name="customers" />
                  <strong>{text('No customers to show', 'مفيش عملاء للعرض')}</strong>
                  <span>
                    {search
                      ? text('Try another name or phone number.', 'جرّب اسم أو رقم موبايل تاني.')
                      : text(
                          'Add your first customer to start keeping track.',
                          'أضف أول عميل وابدأ متابعة علاقتك بيه.',
                        )}
                  </span>
                </div>
              )}
            </div>
          </div>
          <footer className="customers-pagination">
            <span>
              {text('Page', 'صفحة')} {formatNumber(cursors.length + 1)}
            </span>
            <div>
              <button
                type="button"
                disabled={loading || cursors.length === 0}
                onClick={() =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    const previous = next.getAll('page').slice(0, -1);
                    next.delete('page');
                    previous.forEach((cursor) => next.append('page', cursor));
                    return next;
                  })
                }
              >
                {text('Previous', 'السابق')}
              </button>
              <button
                type="button"
                disabled={loading || !page?.nextCursor}
                onClick={() => {
                  if (page?.nextCursor)
                    setParams((current) => {
                      const next = new URLSearchParams(current);
                      next.append('page', page.nextCursor!);
                      return next;
                    });
                }}
              >
                {text('Next', 'التالي')}
              </button>
            </div>
          </footer>
        </section>
        {selectedId && (
          <CustomerDetails
            key={selectedId}
            id={selectedId}
            refresh={refresh}
            onClose={() => selectCustomer(null)}
            onSaved={saved}
          />
        )}
      </div>
      <p className="customers-live-footnote">
        <Icon name="lock" />
        {text(
          'Private notes and contact details are visible only to your store.',
          'بيانات التواصل والملاحظات الخاصة ظاهرة لفريق متجرك فقط.',
        )}
      </p>
    </section>
  );
}
