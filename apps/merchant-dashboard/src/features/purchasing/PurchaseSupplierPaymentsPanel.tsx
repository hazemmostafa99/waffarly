import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, useLocale } from '@waffarly/ui';
import type { PurchaseCashMovementOption, PurchaseInvoice } from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';
import { inventoryCopy } from '../inventory/inventory-copy.js';

export function PurchaseSupplierPaymentsPanel({
  invoice,
  onInvoiceChange,
  onBusyChange,
}: {
  invoice: PurchaseInvoice;
  onInvoiceChange: (invoice: PurchaseInvoice) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { locale, t, formatDigits, errorText } = useLocale();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const [movements, setMovements] = useState<PurchaseCashMovementOption[]>([]);
  const [movementKey, setMovementKey] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [editing, setEditing] = useState(false);
  const [movementRefresh, setMovementRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    setLoadingMovements(true);
    setError('');
    const params = new URLSearchParams({ limit: '50' });
    if (invoice.warehouseBranchId) params.set('branchId', invoice.warehouseBranchId);
    void apiRequest<PurchaseCashMovementOption[]>(
      `/owner/purchasing/cash-movements?${params.toString()}`,
    )
      .then((rows) => current && setMovements(rows))
      .catch((cause: unknown) => {
        if (current)
          setError(
            cause instanceof Error
              ? errorText(cause.message)
              : text('Could not load recorded cash movements.'),
          );
      })
      .finally(() => {
        if (current) setLoadingMovements(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, invoice.warehouseBranchId, locale, t, movementRefresh]);

  const selected = movements.find((row) => keyOf(row) === movementKey) ?? null;
  const due = invoice.balanceDue ?? invoice.totalAmount;
  const payments = invoice.payments ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy || !amount.trim() || !reason.trim()) return;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      await apiRequest(`/owner/purchasing/invoices/${invoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          amount: amount.trim(),
          reason: reason.trim(),
          source: {
            sourceType: selected.sourceType,
            movementId: selected.movementId,
            ...(selected.sourceType === 'drawer' ? { shiftId: selected.shiftId } : {}),
          },
        }),
      });
      const refreshed = await apiRequest<PurchaseInvoice>(
        `/owner/purchasing/invoices/${invoice.id}`,
      );
      onInvoiceChange(refreshed);
      setAmount('');
      setReason('');
      setMovementKey('');
      const params = new URLSearchParams({ limit: '50' });
      if (invoice.warehouseBranchId) params.set('branchId', invoice.warehouseBranchId);
      const remaining = await apiRequest<PurchaseCashMovementOption[]>(
        `/owner/purchasing/cash-movements?${params.toString()}`,
      );
      setMovements(remaining);
      setEditing(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not record this supplier payment.'),
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <section className="invoice-payment-section">
      <dl className="invoice-review-amounts">
        <div>
          <dt>{text('Paid')}</dt>
          <dd>
            {invoice.paidAmount == null ? text('Not available') : formatDigits(invoice.paidAmount)}
          </dd>
        </div>
        <div>
          <dt>{text('Credits')}</dt>
          <dd>
            {invoice.creditNoteAmount == null
              ? text('Not available')
              : formatDigits(invoice.creditNoteAmount)}
          </dd>
        </div>
        <div>
          <dt>{text('Balance due')}</dt>
          <dd>
            {invoice.balanceDue == null ? text('Not available') : formatDigits(invoice.balanceDue)}
          </dd>
        </div>
      </dl>
      {error && (
        <div className="inventory-error" role="alert">
          <span>{error}</span>
          {movements.length === 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={loadingMovements}
              onClick={() => setMovementRefresh((key) => key + 1)}
            >
              {text('Retry')}
            </Button>
          )}
        </div>
      )}
      {invoice.balanceDue !== '0.00' &&
        invoice.balanceDue !== null &&
        Number(invoice.balanceDue ?? 0) > 0 && (
          <>
            {!editing && (
              <div className="invoice-review-action-intro">
                <p>
                  {text(
                    'Link an existing cash outflow to this invoice. No new cash movement is created.',
                  )}
                </p>
                <Button type="button" onClick={() => setEditing(true)}>
                  {text('Add supplier payment')}
                </Button>
              </div>
            )}
            {editing && (
              <form
                className="inventory-payment-form invoice-operation-form"
                onSubmit={(event) => void submit(event)}
              >
                <div className="inventory-detail-heading">
                  <h3>{text('Add supplier payment')}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setEditing(false)}
                  >
                    {text('Cancel')}
                  </Button>
                </div>
                <p className="inventory-secondary-note">
                  {text(
                    'This only allocates a previously recorded cash outflow. It does not create or change cash.',
                  )}
                </p>
                {loadingMovements ? (
                  <p role="status">{text('Loading recorded cash movements…')}</p>
                ) : (
                  movements.length === 0 &&
                  !error && (
                    <div className="invoice-empty-cash">
                      <p className="inventory-note">
                        {text('No recorded cash outflows are available to link.')}
                      </p>
                      <Link to="/pos-cash" className="inventory-detail-link">
                        {text('Open cash and safe')}
                      </Link>
                    </div>
                  )
                )}
                {!loadingMovements && movements.length > 0 && (
                  <>
                    <div className="inventory-form-grid">
                      <label className="invoice-full-field">
                        {text('Recorded cash outflow')}
                        <select
                          value={movementKey}
                          onChange={(event) => setMovementKey(event.target.value)}
                          required
                          disabled={busy || loadingMovements}
                        >
                          <option value="">{text('Choose an existing cash movement')}</option>
                          {movements.map((row) => (
                            <option key={keyOf(row)} value={keyOf(row)}>
                              {text(row.sourceType === 'safe' ? 'Safe' : 'Register')} ·{' '}
                              {formatDigits(row.availableAmount)} ·{' '}
                              {formatDigits(row.createdAt.slice(0, 10))} ·{' '}
                              {formatDigits(row.reason)}
                            </option>
                          ))}
                        </select>
                        {selected && (
                          <small>
                            {text('Available cash amount')}:{' '}
                            {formatDigits(selected.availableAmount)}
                          </small>
                        )}
                      </label>
                      <label>
                        {text('Payment amount (EGP)')}
                        <Input
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          max={selected?.availableAmount ?? due ?? undefined}
                          required
                          disabled={busy}
                        />
                      </label>
                      <label>
                        {text('Payment note')}
                        <Input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          maxLength={500}
                          required
                          disabled={busy}
                        />
                      </label>
                    </div>
                    <div className="invoice-operation-submit">
                      <Button
                        type="submit"
                        disabled={busy || !selected || !amount || !reason.trim()}
                      >
                        {text(busy ? 'Saving…' : 'Record payment')}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            )}
          </>
        )}
      <details className="inventory-section-details invoice-payment-history">
        <summary>
          {text('Supplier payment history')} ({formatDigits(String(payments.length))})
        </summary>
        {payments.length > 0 ? (
          <ul className="invoice-event-list">
            {payments.map((payment) => (
              <li key={payment.id}>
                <div>
                  <strong>{formatDigits(payment.amount)}</strong>
                  <span>
                    {text(
                      payment.sourceType === 'safe'
                        ? 'Cash safe withdrawal'
                        : 'Register cash outflow',
                    )}{' '}
                    · {formatDigits(payment.paidAt.slice(0, 10))}
                  </span>
                </div>
                <p>{formatDigits(payment.reason)}</p>
                <small>
                  {text('Cash event')}: {payment.sourceMovementId}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inventory-secondary-note">{text('No supplier payments recorded yet.')}</p>
        )}
      </details>
    </section>
  );
}

function keyOf(row: PurchaseCashMovementOption) {
  return `${row.sourceType}:${row.movementId}:${row.shiftId ?? ''}`;
}
