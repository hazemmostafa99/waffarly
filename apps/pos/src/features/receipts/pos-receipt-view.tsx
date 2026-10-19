import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { PosReceipt } from '@waffarly/contracts';
import { useLocale } from '@waffarly/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { PosButton } from '../../components/pos-button.js';
import { isReadablePosLabel } from '../../lib/display-label.js';
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
  const { t, errorText, formatNumber, locale } = useLocale();
  const query = useQuery({
    queryKey: posCheckReceiptKey(merchantId, orderId, checkId),
    queryFn: ({ signal }) => getPosCheckReceipt(orderId, checkId, signal),
    staleTime: Infinity,
  });

  if (query.isLoading) {
    return (
      <div className="grid justify-items-center gap-3 p-4 pb-24 sm:p-6 lg:pb-6" role="status">
        <div className="h-[30rem] w-full max-w-96 animate-pulse rounded-xl border border-border bg-card" />
        <span className="text-sm text-muted-foreground">{t('Loading receipt...')}</span>
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="grid justify-items-center gap-4 p-4 pb-24 sm:p-6 lg:pb-6">
        <p
          className="m-0 w-full max-w-96 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
          role="alert"
        >
          {errorText(
            query.error instanceof Error
              ? query.error.message
              : t('Receipt details could not be loaded.'),
          )}
        </p>
        <div className="flex w-full max-w-96 justify-start">
          <PosButton type="button" variant="outline" onClick={onBack}>
            <ArrowLeft aria-hidden="true" size={16} />
            {backLabel ? t(backLabel) : t('Back to checkout')}
          </PosButton>
        </div>
      </div>
    );
  }

  return (
    <ReceiptDocument
      receipt={query.data}
      locale={locale}
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
  locale,
  t,
  formatCount,
  formatMoney,
  backLabel,
  onBack,
}: {
  receipt: PosReceipt;
  locale: 'en' | 'ar';
  t: (value: string) => string;
  formatCount: (value: number) => string;
  formatMoney: (amount: string, currency: string) => string;
  backLabel: string;
  onBack: () => void;
}) {
  const [printError, setPrintError] = useState(false);
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
  const cashierName = isReadablePosLabel(receipt.cashierName)
    ? receipt.cashierName.trim()
    : t('Cashier name unavailable');

  function openPrintDialog() {
    setPrintError(false);
    try {
      if (typeof window.print !== 'function') throw new Error('Print is unavailable.');
      window.print();
    } catch {
      setPrintError(true);
    }
  }

  return (
    <div className="grid content-start justify-items-center gap-4 overflow-auto p-4 pb-24 sm:p-6 lg:pb-6">
      <article
        className="pos-receipt-document w-full max-w-96 rounded-xl border border-neutral-200 bg-white p-5 font-mono text-[0.72rem] leading-relaxed text-neutral-900 shadow-sm sm:p-6"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        aria-label={t('POS receipt')}
      >
        <header className="grid justify-items-center gap-0.5 border-b border-dashed border-neutral-300 pb-3 text-center">
          <h2 className="m-0 max-w-full break-words text-base font-bold leading-tight">
            {receipt.merchantName}
          </h2>
          {receipt.branchName && (
            <p className="m-0 max-w-full break-words text-neutral-600">{receipt.branchName}</p>
          )}
          {receipt.registerName && (
            <p className="m-0 max-w-full break-words text-neutral-600">{receipt.registerName}</p>
          )}
          <strong className="mt-2 rounded-full bg-neutral-100 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wide">
            {t('POS receipt')}
          </strong>
        </header>

        <dl className="m-0 grid gap-2 border-b border-dashed border-neutral-300 py-3 text-xs">
          <ReceiptMetaRow label={t('Receipt number')} value={receipt.receiptNumber} />
          <ReceiptMetaRow label={t('Order')} value={receipt.orderReference} />
          <ReceiptMetaRow label={t('Issued')} value={issuedAt} />
          <ReceiptMetaRow label={t('Check')} value={formatCount(receipt.checkNumber)} />
          <ReceiptMetaRow label={t('Service type')} value={fulfillmentLabel} />
          {receipt.tableCode && <ReceiptMetaRow label={t('Table')} value={receipt.tableCode} />}
          <ReceiptMetaRow label={t('Cashier')} value={cashierName} />
        </dl>

        <section className="border-b border-dashed border-neutral-300 py-3" aria-label={t('Items')}>
          <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_auto] items-start gap-2 pb-2 text-[0.62rem] font-bold uppercase tracking-wide text-neutral-600">
            <span>{t('Item')}</span>
            <span className="text-end">{t('Qty')}</span>
            <span className="text-end">{t('Amount')}</span>
          </div>
          {receipt.items.length > 0 ? (
            <div className="grid gap-3">
              {receipt.items.map((item, index) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_2.25rem_auto] items-start gap-2"
                  key={`${item.name}-${index}`}
                >
                  <div className="grid min-w-0 gap-0.5">
                    <strong className="break-words">{item.name}</strong>
                    {item.variantName && (
                      <small className="break-words text-neutral-600">{item.variantName}</small>
                    )}
                    {item.selections.map((selection) => (
                      <small className="break-words text-neutral-600" key={selection}>
                        {selection}
                      </small>
                    ))}
                  </div>
                  <span className="text-end tabular-nums">{formatCount(item.quantity)}</span>
                  <strong className="whitespace-nowrap text-end tabular-nums">
                    {formatMoney(item.total, receipt.currency)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_auto] items-start gap-2">
              <strong className="break-words">
                {t(receipt.splitMethod === 'equal' ? 'Equal split share' : 'Custom split share')}
              </strong>
              <span className="text-end tabular-nums">1</span>
              <strong className="whitespace-nowrap text-end tabular-nums">
                {formatMoney(receipt.amount, receipt.currency)}
              </strong>
            </div>
          )}
        </section>

        <section className="grid gap-2 border-b border-dashed border-neutral-300 py-3">
          <ReceiptAmountRow
            label={t('Check amount')}
            amount={formatMoney(receipt.amount, receipt.currency)}
          />
          <div className="border-t border-neutral-400 pt-2">
            <ReceiptAmountRow
              label={t('Paid amount')}
              amount={formatMoney(receipt.paidAmount, receipt.currency)}
              emphasized
            />
          </div>
        </section>

        <section className="grid gap-2 pt-3 text-xs" aria-label={t('Recorded payments')}>
          <strong className="mb-0.5">{t('Payment methods')}</strong>
          {receipt.payments.map((payment, index) => (
            <ReceiptAmountRow
              key={`${payment.method}-${index}`}
              label={t(payment.method === 'cash' ? 'Cash' : 'External terminal')}
              amount={formatMoney(payment.amount, receipt.currency)}
            />
          ))}
          {Number(receipt.cashReceivedAmount) > 0 && (
            <ReceiptAmountRow
              label={t('Cash received')}
              amount={formatMoney(receipt.cashReceivedAmount, receipt.currency)}
            />
          )}
          {Number(receipt.changeAmount) > 0 && (
            <ReceiptAmountRow
              label={t('Change to return')}
              amount={formatMoney(receipt.changeAmount, receipt.currency)}
              emphasized
            />
          )}
        </section>

        <footer className="grid justify-items-center gap-3 border-t border-dashed border-neutral-300 pt-4 text-center text-neutral-600">
          <p className="m-0 italic">{t('Thank you for your visit.')}</p>
          <small className="break-all text-[0.58rem]">{receipt.receiptNumber}</small>
        </footer>
      </article>

      <div className="pos-receipt-screen-actions grid w-full max-w-96 grid-cols-1 gap-2 sm:grid-cols-2">
        <PosButton
          type="button"
          variant="outline"
          className="min-h-11 gap-2 sm:col-span-2"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          {backLabel}
        </PosButton>
        <PosButton
          type="button"
          variant="solid"
          className="min-h-11 gap-2 sm:col-span-2"
          onClick={openPrintDialog}
        >
          <Printer aria-hidden="true" size={16} />
          {t('Print / Save PDF')}
        </PosButton>
      </div>
      {printError && (
        <p
          className="m-0 w-full max-w-96 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"
          role="alert"
        >
          {t(
            'Could not open the print dialog. Your receipt is saved; try again or find it in receipt history.',
          )}
        </p>
      )}
      <p className="pos-receipt-pdf-hint m-0 max-w-96 text-center text-xs text-muted-foreground">
        {t('Choose a printer or Save as PDF in the print dialog.')}
      </p>
    </div>
  );
}

function ReceiptMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-neutral-600">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-end font-medium">{value}</dd>
    </div>
  );
}

function ReceiptAmountRow({
  label,
  amount,
  emphasized = false,
}: {
  label: string;
  amount: string;
  emphasized?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${emphasized ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <strong className="whitespace-nowrap text-end tabular-nums">{amount}</strong>
    </div>
  );
}
