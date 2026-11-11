import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CursorPage, CustomerOrderSummary, MerchantCustomer } from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { Icon } from '../../Icons.js';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { ApiError, apiRequestSingle } from '../../lib/api-client.js';
import { CustomerEditor } from './CustomerEditor.js';
import { channelLabel, orderStatusLabel } from './customer-copy.js';
import { useCustomerResource } from './use-customer-resource.js';

export function CustomerDetails({
  id,
  refresh,
  onClose,
  onSaved,
}: {
  id: string;
  refresh: number;
  onClose: () => void;
  onSaved: (customer: MerchantCustomer) => void;
}) {
  const { locale } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [retry, setRetry] = useState(0);
  const {
    data: customer,
    loading,
    error,
  } = useCustomerResource<MerchantCustomer>(`/owner/customers/${id}`, refresh + retry);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [actionError, setActionError] = useState('');
  async function archive() {
    if (!customer || sending.current) return;
    sending.current = true;
    setBusy(true);
    setActionError('');
    try {
      const saved = await apiRequestSingle<MerchantCustomer>(`/owner/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ revision: customer.revision, archived: !customer.archivedAt }),
      });
      setArchiveOpen(false);
      onSaved(saved);
    } catch (cause) {
      setActionError(
        cause instanceof ApiError && cause.statusCode === 409
          ? text(
              'The record changed. Close this dialog and refresh before trying again.',
              'البيانات اتغيّرت. اقفل النافذة وحدّث البيانات قبل المحاولة.',
            )
          : text(
              'Could not confirm the change. Refresh to check the current status.',
              'تعذّر تأكيد التغيير. حدّث البيانات لمراجعة الحالة الحالية.',
            ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <aside className="customer-detail-card" aria-label={text('Customer details', 'تفاصيل العميل')}>
      <div className="customer-detail-actions">
        <span />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={text('Close customer details', 'إغلاق تفاصيل العميل')}
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
      </div>
      {loading ? (
        <p className="customers-empty-state" role="status">
          {text('Loading customer…', 'جاري تحميل العميل…')}
        </p>
      ) : error || !customer ? (
        <div className="customers-empty-state" role="alert">
          <p>
            {text(
              'Customer unavailable. It may have been removed or you may be offline.',
              'تعذّر عرض العميل. راجع الاتصال أو ارجع للقائمة.',
            )}
          </p>
          <Button type="button" variant="outline" onClick={() => setRetry((value) => value + 1)}>
            {text('Try again', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : (
        <>
          <div className="customer-detail-profile">
            <span className="customer-avatar customer-avatar-blue large">
              <Icon name="customers" />
            </span>
            <h3>{customer.name}</h3>
            <div className="customer-detail-statuses">
              <span
                className={`customer-status ${customer.segment === 'vip' ? 'customer-status-vip' : 'customer-status-active'}`}
              >
                {customer.segment === 'vip' ? 'VIP' : text('Regular', 'عادي')}
              </span>
              <span
                className={`customer-status ${customer.archivedAt ? 'customer-status-inactive' : 'customer-status-active'}`}
              >
                <i />
                {customer.archivedAt ? text('Archived', 'مؤرشف') : text('Active', 'نشط')}
              </span>
            </div>
            {customer.phone && (
              <a href={`tel:${customer.phone.replace(/[^+\d]/g, '')}`} dir="ltr">
                <Icon name="phone" />
                <bdi>{customer.phone}</bdi>
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} dir="ltr">
                <Icon name="mail" />
                <bdi>{customer.email}</bdi>
              </a>
            )}
          </div>
          <section className="customer-detail-section">
            <h4>{text('Customer information', 'بيانات العميل')}</h4>
            <dl className="customer-detail-attributes">
              <div>
                <dt>{text('First contact', 'أول قناة وصول')}</dt>
                <dd>{channelLabel(customer.firstChannel, locale)}</dd>
              </div>
              <div>
                <dt>{text('Added', 'تاريخ الإضافة')}</dt>
                <dd>
                  {new Date(customer.createdAt).toLocaleDateString(locale, {
                    timeZone: 'Africa/Cairo',
                  })}
                </dd>
              </div>
            </dl>
          </section>
          <section className="customer-detail-section customer-notes-section">
            <h4>{text('Private notes', 'ملاحظات خاصة')}</h4>
            <p className="customer-note-copy">
              {customer.notes || text('No notes yet.', 'لسه مفيش ملاحظات.')}
            </p>
          </section>
          <div className="customers-live-detail-actions">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
              {text('Edit customer', 'تعديل العميل')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setArchiveOpen(true);
                setActionError('');
              }}
            >
              {customer.archivedAt
                ? text('Restore customer', 'استعادة العميل')
                : text('Archive customer', 'أرشفة العميل')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRetry((value) => value + 1)}
            >
              {text('Refresh', 'تحديث')}
            </Button>
          </div>
          <CustomerOrderHistory key={customer.id} id={customer.id} refresh={refresh} />
          {editing && (
            <CustomerEditor
              customer={customer}
              onClose={() => setEditing(false)}
              onSaved={(saved) => {
                setEditing(false);
                onSaved(saved);
              }}
              onReload={() => setRetry((value) => value + 1)}
            />
          )}
          {archiveOpen && (
            <DashboardDialog
              title={
                customer.archivedAt
                  ? text('Restore customer?', 'استعادة العميل؟')
                  : text('Archive customer?', 'أرشفة العميل؟')
              }
              closeLabel={text('Close', 'إغلاق')}
              onClose={() => setArchiveOpen(false)}
              busy={busy}
            >
              <div className="customer-confirm-dialog">
                <p>
                  {customer.archivedAt
                    ? text(
                        'The customer will appear in your active directory again.',
                        'العميل هيرجع يظهر في قائمة العملاء النشطين.',
                      )
                    : text(
                        'Existing orders stay linked. Archived customers cannot be selected for new order links.',
                        'الطلبات القديمة هتفضل مرتبطة بالعميل. مش هتقدر تختاره لربط طلبات جديدة وهو مؤرشف.',
                      )}
                </p>
                {actionError && (
                  <p className="cd-error" role="alert">
                    {actionError}
                  </p>
                )}
                <footer className="customer-confirm-actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setArchiveOpen(false)}
                  >
                    {text('Cancel', 'إلغاء')}
                  </Button>
                  <Button
                    type="button"
                    disabled={busy || !!actionError}
                    onClick={() => void archive()}
                  >
                    {busy ? text('Saving…', 'جاري الحفظ…') : text('Confirm', 'تأكيد')}
                  </Button>
                </footer>
              </div>
            </DashboardDialog>
          )}
        </>
      )}
    </aside>
  );
}

function CustomerOrderHistory({ id, refresh }: { id: string; refresh: number }) {
  const { locale, formatNumber } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [cursors, setCursors] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const query = new URLSearchParams({ limit: '10' });
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1)!);
  const {
    data: page,
    error,
    loading,
  } = useCustomerResource<CursorPage<CustomerOrderSummary>>(
    `/owner/customers/${id}/orders?${query}`,
    refresh + retry,
  );
  return (
    <section className="customer-detail-section customer-orders-section">
      <h4>{text('Linked orders', 'الطلبات المرتبطة')}</h4>
      {loading ? (
        <p role="status">{text('Loading orders…', 'جاري تحميل الطلبات…')}</p>
      ) : error ? (
        <div role="alert">
          <p>{text('Could not load orders.', 'تعذّر تحميل الطلبات.')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            {text('Try again', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : !page?.items.length ? (
        <p className="cd-muted">{text('No linked orders yet.', 'لسه مفيش طلبات مرتبطة.')}</p>
      ) : (
        <ul>
          {page.items.map((order) => (
            <li key={order.id}>
              <div>
                <strong>
                  {order.source === 'storefront' ? (
                    <Link to={`/orders?orderId=${encodeURIComponent(order.id)}`}>
                      {order.reference ?? order.id.slice(0, 8)}
                    </Link>
                  ) : (
                    (order.reference ?? order.id.slice(0, 8))
                  )}
                </strong>
                <span>{orderStatusLabel(order.status, locale)}</span>
              </div>
              <div>
                <span>
                  {channelLabel(order.source, locale)} ·{' '}
                  {new Date(order.createdAt).toLocaleDateString(locale, {
                    timeZone: 'Africa/Cairo',
                  })}
                </span>
                <strong>
                  <bdi>
                    {order.total} {text('EGP', 'ج.م')}
                  </bdi>
                </strong>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="customers-pagination customer-orders-pagination">
        <span>
          {text('Page', 'صفحة')} {formatNumber(cursors.length + 1)}
        </span>
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !cursors.length}
            onClick={() => setCursors((current) => current.slice(0, -1))}
          >
            {text('Previous', 'السابق')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !page?.nextCursor}
            onClick={() => {
              if (page?.nextCursor) setCursors((current) => [...current, page.nextCursor!]);
            }}
          >
            {text('Next', 'التالي')}
          </Button>
        </div>
      </div>
    </section>
  );
}
