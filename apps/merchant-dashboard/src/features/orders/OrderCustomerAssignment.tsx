import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MerchantCustomer, OrderCustomerContext } from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { ApiError, apiRequestSingle } from '../../lib/api-client.js';
import { useCustomerResource } from '../customers/use-customer-resource.js';
import '../customers/customers.css';

export function OrderCustomerAssignment({
  orderId,
  onSaved,
}: {
  orderId: string;
  onSaved: () => void;
}) {
  const { locale } = useLocale();
  const text = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [refresh, setRefresh] = useState(0);
  const {
    data: context,
    error,
    loading,
  } = useCustomerResource<OrderCustomerContext>(`/owner/orders/${orderId}/customer`, refresh);
  const [selected, setSelected] = useState<MerchantCustomer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const sending = useRef(false);

  async function save() {
    if (!context || !selected || sending.current) return;
    sending.current = true;
    setBusy(true);
    setActionError('');
    const body = pending ?? JSON.stringify({ revision: context.revision, customerId: selected.id });
    setPending(body);
    try {
      await apiRequestSingle(`/owner/orders/${orderId}/customer`, { method: 'PUT', body });
      setPending(null);
      setConfirming(false);
      setRefresh((value) => value + 1);
      onSaved();
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode >= 400 && cause.statusCode < 500) {
        setPending(null);
        setConfirming(false);
        setRefresh((value) => value + 1);
        setActionError(
          text(
            'The order or customer changed. Check the latest details and select again.',
            'بيانات الطلب أو العميل اتغيّرت. راجع أحدث البيانات واختار من جديد.',
          ),
        );
      } else
        setActionError(
          text(
            'The result is uncertain. Retry the same link before selecting another customer.',
            'نتيجة الربط مش مؤكدة. أعد نفس المحاولة قبل اختيار عميل تاني.',
          ),
        );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="cd-assignment"
      aria-label={text('Order customer', 'عميل الطلب')}
      aria-busy={busy}
    >
      <h4>{text('Customer record', 'ملف العميل')}</h4>
      {loading ? (
        <p role="status">{text('Loading customer link…', 'جاري تحميل ربط العميل…')}</p>
      ) : error || !context ? (
        <div role="alert">
          <p>{text('Could not load the customer link.', 'تعذّر تحميل ربط العميل.')}</p>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            {text('Try again', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : context.customerId ? (
        <Link to={`/customers?customer=${encodeURIComponent(context.customerId)}`}>
          {text('View linked customer', 'عرض العميل المرتبط')}
        </Link>
      ) : (
        <>
          <p className="cd-muted">
            {text(
              'Choose an existing record in your store. Order contact details stay as recorded at checkout.',
              'اختار ملف عميل موجود في متجرك. بيانات التواصل وقت الطلب هتفضل محفوظة.',
            )}
          </p>
          <PagedEntitySelect<MerchantCustomer>
            path="/owner/customers"
            value={selected?.id ?? ''}
            label={text('Choose customer', 'اختيار العميل')}
            onSelect={(customer) => {
              setSelected(customer);
              setConfirming(false);
              setActionError('');
            }}
            optionLabel={(customer) =>
              `${customer.name}${customer.phone ? ` · ${customer.phone}` : ''}`
            }
            disabled={busy || pending !== null}
            emptyState={
              <Link to="/customers">{text('Add a customer first', 'أضف عميل الأول')}</Link>
            }
          />
          {confirming ? (
            <div>
              <p>
                {text(
                  `Link this order to ${selected?.name}? This link cannot be replaced here.`,
                  `ربط الطلب بالعميل ${selected?.name}؟ مش هتقدر تبدّل الربط من هنا.`,
                )}
              </p>
              <div className="cd-actions">
                <Button size="sm" type="button" disabled={busy} onClick={() => void save()}>
                  {busy
                    ? text('Linking…', 'جاري الربط…')
                    : pending
                      ? text('Retry same link', 'إعادة نفس الربط')
                      : text('Confirm link', 'تأكيد الربط')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={busy || pending !== null}
                  onClick={() => setConfirming(false)}
                >
                  {text('Cancel', 'إلغاء')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={!selected || busy}
              onClick={() => setConfirming(true)}
            >
              {text('Link customer', 'ربط العميل')}
            </Button>
          )}
        </>
      )}
      {actionError && (
        <p className="cd-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
