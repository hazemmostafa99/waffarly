import { useLocale } from '@waffarly/ui';
import { extras, products } from '../prototype-data.js';
import { orderDue, orderTotal, type DemoOrder } from '../prototype-model.js';
import { useMoney } from '../use-money.js';

export function SampleReceiptDocument({ order }: { order: DemoOrder }) {
  const { t, locale } = useLocale();
  const money = useMoney();
  const total = orderTotal(order);
  const due = orderDue(order);
  const collected = order.payments.reduce((sum, payment) => sum + payment.cents, 0);
  const issuedAt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(order.createdAt));

  return (
    <div className="receipt-preview-stage">
      <article className="receipt-paper" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <header className="receipt-brand">
          <span className="receipt-mark" aria-hidden="true">
            W
          </span>
          <strong>Waffarly Bakery &amp; Cafe</strong>
          <span>Maadi branch · Sample register</span>
          <b>{t('SAMPLE · NOT A FISCAL DOCUMENT')}</b>
        </header>

        <div className="receipt-meta">
          <div>
            <span>{t('Order')}</span>
            <strong>#{order.number}</strong>
          </div>
          <div>
            <span>{t('Date')}</span>
            <strong>{issuedAt}</strong>
          </div>
          <div>
            <span>{t('Cashier')}</span>
            <strong>Hana K.</strong>
          </div>
          <div>
            <span>{t('Service')}</span>
            <strong>
              {order.fulfillment === 'dine-in'
                ? `${t('Dine in')} · ${t('Table')} #${String(order.table).padStart(2, '0')}`
                : t(order.fulfillment === 'delivery' ? 'Delivery' : 'Takeaway')}
            </strong>
          </div>
          {order.customerName && (
            <div>
              <span>{t('Customer')}</span>
              <strong>{order.customerName}</strong>
            </div>
          )}
          {order.customerPhone && (
            <div>
              <span>{t('Phone')}</span>
              <strong>{order.customerPhone}</strong>
            </div>
          )}
          {order.deliveryAddress && (
            <div className="receipt-address">
              <span>{t('Address')}</span>
              <strong>{order.deliveryAddress}</strong>
            </div>
          )}
        </div>

        <div className="receipt-items-heading">
          <span>{t('Item / quantity')}</span>
          <span>{t('Amount')}</span>
        </div>
        <div className="receipt-items">
          {order.lines.map((line) => {
            const product = products.find((item) => item.id === line.productId);
            const optionNames = line.extras
              .map((id) => extras.find((extra) => extra.id === id)?.name)
              .filter((name): name is string => !!name);
            return (
              <div className="receipt-item" key={line.id}>
                <div className="receipt-item-name">
                  <strong>{t(product?.name ?? 'Unknown item')}</strong>
                  <span>
                    {line.quantity} × {money(line.unitCents)}
                    {line.size === 'large' && ` · ${t('Large')}`}
                    {optionNames.length > 0 &&
                      ` · ${optionNames.map((name) => t(name)).join(', ')}`}
                  </span>
                </div>
                <strong className="receipt-amount">{money(line.quantity * line.unitCents)}</strong>
              </div>
            );
          })}
        </div>

        <div className="receipt-totals">
          <div>
            <span>{t('Subtotal')}</span>
            <strong>{money(total)}</strong>
          </div>
          <p>{t('Taxes and service are not configured in this sample.')}</p>
          <div className="receipt-total">
            <strong>{t('Order total')}</strong>
            <strong>{money(total)}</strong>
          </div>
        </div>

        <div className="receipt-payments">
          <strong className="receipt-section-title">{t('Payments recorded')}</strong>
          {order.payments.length === 0 ? (
            <div>
              <span>{t('No payment recorded')}</span>
              <span>{money(0)}</span>
            </div>
          ) : (
            order.payments.map((payment, index) => (
              <section key={payment.id}>
                <div>
                  <span>
                    {t(payment.method === 'cash' ? 'Cash' : 'External terminal')} {index + 1}
                  </span>
                  <strong>{money(payment.cents)}</strong>
                </div>
                {payment.method === 'cash' && (
                  <>
                    <div>
                      <span>{t('Cash received')}</span>
                      <span>{money(payment.receivedCents)}</span>
                    </div>
                    <div>
                      <span>{t('Change given')}</span>
                      <span>{money(payment.changeCents)}</span>
                    </div>
                  </>
                )}
              </section>
            ))
          )}
          <div className="receipt-balance">
            <span>{due > 0 ? t('Remaining balance') : t('Paid')}</span>
            <strong>{money(due > 0 ? due : collected)}</strong>
          </div>
        </div>

        <footer className="receipt-footer">
          <span>{t('Thank you for visiting.')}</span>
          <small>{t('Design preview · Order summary · No fiscal numbering')}</small>
        </footer>
      </article>
    </div>
  );
}
