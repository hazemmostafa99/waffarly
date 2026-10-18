import { useQuery } from '@tanstack/react-query';
import type { PosReceipt } from '@waffarly/contracts';
import { Button, useLocale } from '@waffarly/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { getPosCheckReceipt, posCheckReceiptKey } from './pos-receipts.api.js';
import './receipt-print.css';

export function PosReceiptView({
  merchantId,
  orderId,
  checkId,
  backLabel,
  onBack,
}: {
  merchantId: string;
  orderId: string;
  checkId: string;
  backLabel?: string;
  onBack: () => void;
}) {
  const { t, errorText, formatNumber } = useLocale();
  const query = useQuery({
    queryKey: posCheckReceiptKey(merchantId, orderId, checkId),
    queryFn: ({ signal }) => getPosCheckReceipt(orderId, checkId, signal),
    staleTime: Infinity,
  });

  if (query.isLoading) {
    return (
      <p className="p-5 text-sm text-muted-foreground" role="status">
        {t('Loading receipt...')}
      </p>
    );
  }
  if (!query.data) {
    return (
      <div className="grid gap-4 p-5">
        <p
          className="m-0 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
          role="alert"
        >
          {errorText(
            query.error instanceof Error
              ? query.error.message
              : t('Receipt details could not be loaded.'),
          )}
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            {backLabel ? t(backLabel) : t('Back to checkout')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ReceiptDocument
      receipt={query.data}
      t={t}
      formatCount={formatNumber}
      formatMoney={(amount, currency) =>
        formatNumber(Number(amount), { style: 'currency', currency })
      }
      backLabel={backLabel ? t(backLabel) : t('Back to checkout')}
      onBack={onBack}
    />
  );
}

function ReceiptDocument({
  receipt,
  t,
  formatCount,
  formatMoney,
  backLabel,
  onBack,
}: {
  receipt: PosReceipt;
  t: (value: string) => string;
  formatCount: (value: number) => string;
  formatMoney: (amount: string, currency: string) => string;
  backLabel: string;
  onBack: () => void;
}) {
  const dateLocale = document.documentElement.lang || undefined;
  const issuedAt = new Intl.DateTimeFormat(dateLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(receipt.issuedAt));
  const fulfillmentLabel =
    receipt.fulfillmentType === 'dine_in'
      ? t('Dine in')
      : receipt.fulfillmentType === 'delivery'
        ? t('Delivery')
        : t('Takeaway');

  return (
    <div className="pos-receipt-screen">
      <article className="pos-receipt-document" dir="auto" aria-label={t('POS receipt')}>
        <header className="pos-receipt-header">
          <h2>{receipt.merchantName}</h2>
          {receipt.branchName && <p>{receipt.branchName}</p>}
          {receipt.registerName && <p>{receipt.registerName}</p>}
          <strong>{t('POS receipt')}</strong>
        </header>

        <dl className="pos-receipt-meta">
          <div>
            <dt>{t('Receipt number')}</dt>
            <dd>{receipt.receiptNumber}</dd>
          </div>
          <div>
            <dt>{t('Order')}</dt>
            <dd>{receipt.orderReference}</dd>
          </div>
          <div>
            <dt>{t('Issued')}</dt>
            <dd>{issuedAt}</dd>
          </div>
          <div>
            <dt>{t('Check')}</dt>
            <dd>{formatCount(receipt.checkNumber)}</dd>
          </div>
          <div>
            <dt>{t('Service type')}</dt>
            <dd>{fulfillmentLabel}</dd>
          </div>
          {receipt.tableCode && (
            <div>
              <dt>{t('Table')}</dt>
              <dd>{receipt.tableCode}</dd>
            </div>
          )}
          <div>
            <dt>{t('Cashier')}</dt>
            <dd>{receipt.cashierName}</dd>
          </div>
        </dl>

        <section className="pos-receipt-items" aria-label={t('Items')}>
          <div className="pos-receipt-table-head">
            <span>{t('Item')}</span>
            <span>{t('Qty')}</span>
            <span>{t('Amount')}</span>
          </div>
          {receipt.items.length > 0 ? (
            receipt.items.map((item, index) => (
              <div className="pos-receipt-line" key={`${item.name}-${index}`}>
                <div className="pos-receipt-item-name">
                  <strong>{item.name}</strong>
                  {item.variantName && <small>{item.variantName}</small>}
                  {item.selections.map((selection) => (
                    <small key={selection}>{selection}</small>
                  ))}
                </div>
                <span className="pos-receipt-qty">{formatCount(item.quantity)}</span>
                <strong className="pos-receipt-amount">
                  {formatMoney(item.total, receipt.currency)}
                </strong>
              </div>
            ))
          ) : (
            <div className="pos-receipt-line">
              <div className="pos-receipt-item-name">
                <strong>
                  {t(receipt.splitMethod === 'equal' ? 'Equal split share' : 'Custom split share')}
                </strong>
              </div>
              <span className="pos-receipt-qty">1</span>
              <strong className="pos-receipt-amount">
                {formatMoney(receipt.amount, receipt.currency)}
              </strong>
            </div>
          )}
        </section>

        <section className="pos-receipt-totals">
          <div>
            <span>{t('Check amount')}</span>
            <strong>{formatMoney(receipt.amount, receipt.currency)}</strong>
          </div>
          <div className="pos-receipt-grand-total">
            <span>{t('Paid amount')}</span>
            <strong>{formatMoney(receipt.paidAmount, receipt.currency)}</strong>
          </div>
        </section>

        <section className="pos-receipt-payments" aria-label={t('Recorded payments')}>
          <strong>{t('Payment method')}</strong>
          {receipt.payments.map((payment, index) => (
            <div key={`${payment.method}-${index}`}>
              <span>{t(payment.method === 'cash' ? 'Cash' : 'External terminal')}</span>
              <strong>{formatMoney(payment.amount, receipt.currency)}</strong>
            </div>
          ))}
          {Number(receipt.cashReceivedAmount) > 0 && (
            <div>
              <span>{t('Cash received')}</span>
              <span>{formatMoney(receipt.cashReceivedAmount, receipt.currency)}</span>
            </div>
          )}
          {Number(receipt.changeAmount) > 0 && (
            <div>
              <span>{t('Change to return')}</span>
              <strong>{formatMoney(receipt.changeAmount, receipt.currency)}</strong>
            </div>
          )}
        </section>

        <footer className="pos-receipt-footer">
          <p>{t('Thank you for your visit.')}</p>
          <small>{receipt.receiptNumber}</small>
        </footer>
      </article>

      <div className="pos-receipt-screen-actions">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </Button>
        <Button type="button" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          {t('Print / Save PDF')}
        </Button>
      </div>
      <p className="pos-receipt-pdf-hint">
        {t('Choose a printer or Save as PDF in the print dialog.')}
      </p>
    </div>
  );
}
