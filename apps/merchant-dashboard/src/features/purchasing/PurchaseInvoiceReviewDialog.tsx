import { useEffect, useRef, useState } from 'react';
import type { PurchaseInvoice, PurchaseInvoiceLine } from '@waffarly/contracts';
import { Badge, Button, DataTable, useLocale, type DataTableColumn } from '@waffarly/ui';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { stockDecimalLabel, stockUnitLabel } from '../inventory/stock-unit-options.js';
import { PurchaseSupplierPaymentsPanel } from './PurchaseSupplierPaymentsPanel.js';
import { PurchaseInvoiceAdjustmentsPanel } from './PurchaseInvoiceAdjustmentsPanel.js';

type ReviewSection = 'overview' | 'payments' | 'adjustments';

export function PurchaseInvoiceReviewDialog({
  invoice,
  busy,
  error,
  copy: text,
  onClose,
  onConfirm,
  onEdit,
  onInvoiceChange,
}: {
  invoice: PurchaseInvoice;
  busy: boolean;
  error: string;
  copy: (value: string) => string;
  onClose: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  onInvoiceChange: (invoice: PurchaseInvoice) => void;
}) {
  const { locale, formatDigits } = useLocale();
  const [section, setSection] = useState<ReviewSection>('overview');
  const [actionBusy, setActionBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [section]);
  const locked = busy || actionBusy;
  const isDraft = invoice.status === 'draft';
  const money = (value: string | null | undefined) =>
    value == null ? text('Cost not recorded') : formatDigits(value);
  const columns: DataTableColumn<PurchaseInvoiceLine>[] = [
    {
      id: 'item',
      header: text('Stock item'),
      cell: (line) => (
        <div className="inventory-table-name">
          <strong>{formatDigits(line.stockItemName)}</strong>
          <small>{text(line.condition === 'available' ? 'Available' : 'Non-Sellable')}</small>
        </div>
      ),
    },
    {
      id: 'quantity',
      header: text('Quantity'),
      cell: (line) =>
        `${formatDigits(stockDecimalLabel(line.quantity))} ${stockUnitLabel(line.unitCode, locale, line.unitName)}`,
    },
    {
      id: 'cost',
      header: text('Original unit cost (EGP)'),
      cell: (line) => money(line.unitCost),
    },
    {
      id: 'total',
      header: text('Final line total (EGP)'),
      cell: (line) => money(line.lineTotal),
    },
  ];

  return (
    <DashboardDialog
      title={text(isDraft ? 'Review receipt' : 'Supplier invoice details')}
      closeLabel={text('Close')}
      onClose={() => !locked && onClose()}
      busy={locked}
      wide
      className="invoice-review-dialog"
    >
      <div className="invoice-review-body" ref={bodyRef}>
        {error && (
          <p className="inventory-error" role="alert">
            {error}
          </p>
        )}
        <div className="invoice-review-identity">
          <div>
            <strong>{formatDigits(invoice.supplierName)}</strong>
            <span>
              {text('Supplier invoice number')}:{' '}
              {formatDigits(invoice.supplierInvoiceNumber || '—')}
            </span>
          </div>
          <Badge variant={isDraft ? 'warning' : 'success'}>
            {text(isDraft ? 'Draft' : 'Confirmed')}
          </Badge>
        </div>
        <p className="inventory-secondary-note invoice-review-currency">{text('Amounts in EGP')}</p>
        {!isDraft && (
          <nav className="invoice-review-navigation" aria-label={text('Invoice sections')}>
            {(
              [
                ['overview', 'Invoice summary'],
                ['payments', 'Supplier payment'],
                ['adjustments', 'Corrections and returns'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={section === value}
                aria-controls={`invoice-review-${value}`}
                disabled={locked}
                onClick={() => setSection(value)}
              >
                {text(label)}
              </button>
            ))}
          </nav>
        )}
        <section
          id="invoice-review-overview"
          hidden={section !== 'overview'}
          aria-label={text('Invoice summary')}
        >
          <dl className="invoice-review-facts">
            <div>
              <dt>{text('Warehouse')}</dt>
              <dd>{formatDigits(`${invoice.branchName} · ${invoice.warehouseName}`)}</dd>
            </div>
            <div>
              <dt>{text('Invoice date')}</dt>
              <dd>
                <bdi>{formatDigits(invoice.invoiceDate || '—')}</bdi>
              </dd>
            </div>
          </dl>
          <dl className="invoice-review-amounts">
            <div>
              <dt>{text('Invoice total (EGP)')}</dt>
              <dd>{money(invoice.totalAmount)}</dd>
            </div>
            <div>
              <dt>{text('Discount (EGP)')}</dt>
              <dd>{money(invoice.discountAmount)}</dd>
            </div>
            <div>
              <dt>{text('Shipping (EGP)')}</dt>
              <dd>{money(invoice.shippingAmount)}</dd>
            </div>
          </dl>
          <p className="inventory-secondary-note">
            {text('Taxes are not included in this invoice total yet.')}
          </p>
          {invoice.correctedTotalAmount != null &&
            invoice.correctedTotalAmount !== invoice.totalAmount && (
              <p className="invoice-review-corrected-total">
                {text('Corrected invoice total (EGP)')}:{' '}
                <strong>{money(invoice.correctedTotalAmount)}</strong>
              </p>
            )}
          {isDraft && (
            <p className="inventory-note">
              {text('Receiving this purchase adds the quantities below to:')}{' '}
              <strong>{formatDigits(invoice.warehouseName)}</strong>
            </p>
          )}
          {isDraft &&
            invoice.lines.some((line) => line.unitCost === null || line.lineTotal === null) && (
              <p className="inventory-error" role="alert">
                {text('Add a unit cost to every line before confirming this invoice.')}
              </p>
            )}
          <h3 className="invoice-review-section-title">{text('Items and quantities')}</h3>
          <DataTable
            columns={columns}
            rows={invoice.lines}
            rowKey={(line) => line.id}
            caption={text('Items and quantities')}
            emptyState={text('No invoice items.')}
          />
          <details className="inventory-section-details invoice-review-calculation">
            <summary>{text('Cost breakdown and invoice notes')}</summary>
            <dl className="invoice-review-facts">
              <div>
                <dt>{text('Subtotal (EGP)')}</dt>
                <dd>{money(invoice.subtotalAmount)}</dd>
              </div>
              {invoice.discountType === 'percentage' && (
                <div>
                  <dt>{text('Discount')}</dt>
                  <dd>{formatDigits(invoice.discountValue ?? '0')}%</dd>
                </div>
              )}
            </dl>
            <ul className="invoice-line-breakdown">
              {invoice.lines.map((line) => (
                <li key={line.id}>
                  <strong>{formatDigits(line.stockItemName)}</strong>
                  <dl className="invoice-review-facts">
                    <div>
                      <dt>{text('Base unit')}</dt>
                      <dd>{stockUnitLabel(line.baseUnit, locale)}</dd>
                    </div>
                    <div>
                      <dt>{text('Line subtotal (EGP)')}</dt>
                      <dd>{money(line.lineSubtotal)}</dd>
                    </div>
                    <div>
                      <dt>{text('Discount share')}</dt>
                      <dd>{money(line.discountAllocation)}</dd>
                    </div>
                    <div>
                      <dt>{text('Shipping share')}</dt>
                      <dd>{money(line.shippingAllocation)}</dd>
                    </div>
                    {line.correctedUnitCost != null && (
                      <div>
                        <dt>{text('Current corrected unit cost')}</dt>
                        <dd>{money(line.correctedUnitCost)}</dd>
                      </div>
                    )}
                  </dl>
                </li>
              ))}
            </ul>
            {invoice.notes && (
              <p className="invoice-review-notes">
                {text('Notes')}: {invoice.notes}
              </p>
            )}
          </details>
          <p className="inventory-secondary-note">
            {text(
              isDraft
                ? 'This invoice is a draft. Saving it does not affect stock.'
                : 'A confirmed purchase invoice cannot be edited. Correct stock with a separate reviewed movement.',
            )}
          </p>
        </section>
        {!isDraft && (
          <>
            <section
              id="invoice-review-payments"
              hidden={section !== 'payments'}
              aria-label={text('Supplier payment')}
            >
              <PurchaseSupplierPaymentsPanel
                invoice={invoice}
                onInvoiceChange={onInvoiceChange}
                onBusyChange={setActionBusy}
              />
            </section>
            <section
              id="invoice-review-adjustments"
              hidden={section !== 'adjustments'}
              aria-label={text('Corrections and returns')}
            >
              <PurchaseInvoiceAdjustmentsPanel
                invoice={invoice}
                onInvoiceChange={onInvoiceChange}
                onBusyChange={setActionBusy}
              />
            </section>
          </>
        )}
      </div>
      <footer className="products-dialog-footer invoice-review-footer">
        <div className="invoice-review-footer-actions">
          {isDraft && (
            <>
              <Button
                type="button"
                disabled={
                  locked ||
                  invoice.lines.some((line) => line.unitCost === null || line.lineTotal === null)
                }
                onClick={onConfirm}
              >
                {text(busy ? 'Posting…' : 'Confirm receipt')}
              </Button>
              <Button type="button" variant="outline" disabled={locked} onClick={onEdit}>
                {text('Edit draft')}
              </Button>
            </>
          )}
          {actionBusy && <span role="status">{text('Saving…')}</span>}
        </div>
        <Button type="button" variant="outline" disabled={locked} onClick={onClose}>
          {text('Close')}
        </Button>
      </footer>
    </DashboardDialog>
  );
}
