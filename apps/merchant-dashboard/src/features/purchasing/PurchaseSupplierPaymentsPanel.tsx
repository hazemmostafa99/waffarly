import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input, useLocale } from '@waffarly/ui';
import type { PurchaseCashMovementOption, PurchaseInvoice } from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';
import { inventoryCopy } from '../inventory/inventory-copy.js';

export function PurchaseSupplierPaymentsPanel({
  invoice,
  onInvoiceChange,
}: {
  invoice: PurchaseInvoice;
  onInvoiceChange: (invoice: PurchaseInvoice) => void;
}) {
  const { locale, t, formatDigits, errorText } = useLocale();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const [movements, setMovements] = useState<PurchaseCashMovementOption[]>([]);
  const [movementKey, setMovementKey] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ limit: '50' });
    if (invoice.warehouseBranchId) params.set('branchId', invoice.warehouseBranchId);
    void apiRequest<PurchaseCashMovementOption[]>(`/owner/purchasing/cash-movements?${params.toString()}`)
      .then((rows) => current && setMovements(rows))
      .catch((cause: unknown) => {
        if (current) setError(cause instanceof Error ? errorText(cause.message) : text('Could not load recorded cash movements.'));
      });
    return () => { current = false; };
  }, [errorText, invoice.warehouseBranchId, locale, t]);

  const selected = movements.find((row) => keyOf(row) === movementKey) ?? null;
  const due = invoice.balanceDue ?? invoice.totalAmount ?? '0.00';
  const payments = invoice.payments ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy || !amount.trim() || !reason.trim()) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/owner/purchasing/invoices/${invoice.id}/payments`, {
        method: 'POST',
        body: {
          requestId: crypto.randomUUID(),
          amount: amount.trim(),
          reason: reason.trim(),
          source: {
            sourceType: selected.sourceType,
            movementId: selected.movementId,
            ...(selected.sourceType === 'drawer' ? { shiftId: selected.shiftId } : {}),
          },
        },
      });
      const refreshed = await apiRequest<PurchaseInvoice>(`/owner/purchasing/invoices/${invoice.id}`);
      onInvoiceChange(refreshed);
      setAmount('');
      setReason('');
      setMovementKey('');
      const params = new URLSearchParams({ limit: '50' });
      if (invoice.warehouseBranchId) params.set('branchId', invoice.warehouseBranchId);
      const remaining = await apiRequest<PurchaseCashMovementOption[]>(`/owner/purchasing/cash-movements?${params.toString()}`);
      setMovements(remaining);
    } catch (cause) {
      setError(cause instanceof Error ? errorText(cause.message) : text('Could not record this supplier payment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="inventory-review-payments">
      <h3>{text('Supplier payment')}</h3>
      <div className="inventory-invoice-review-totals">
        <p><strong>{text('Paid')}:</strong> {formatDigits(invoice.paidAmount ?? '0.00')}</p>
        <p><strong>{text('Credits')}:</strong> {formatDigits(invoice.creditNoteAmount ?? '0.00')}</p>
        <p><strong>{text('Balance due')}:</strong> {formatDigits(due)}</p>
      </div>
      {payments.length > 0 && (
        <ul>
          {payments.map((payment) => (
            <li key={payment.id}>
              <strong>{formatDigits(payment.amount)}</strong> · {text(payment.sourceType === 'safe' ? 'Cash safe withdrawal' : 'Register cash outflow')} · {formatDigits(payment.paidAt.slice(0, 10))}
              <small>{formatDigits(payment.reason)} · {text('Cash event')}: {payment.sourceMovementId}</small>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="inventory-error" role="alert">{error}</p>}
      {invoice.balanceDue !== '0.00' && invoice.balanceDue !== null && Number(invoice.balanceDue ?? 0) > 0 && (
        <form className="inventory-payment-form" onSubmit={(event) => void submit(event)}>
          <label>
            {text('Recorded cash outflow')}
            <select value={movementKey} onChange={(event) => setMovementKey(event.target.value)} required disabled={busy}>
              <option value="">{text('Choose an existing cash movement')}</option>
              {movements.map((row) => (
                <option key={keyOf(row)} value={keyOf(row)}>
                  {text(row.sourceType === 'safe' ? 'Safe' : 'Register')} · {formatDigits(row.availableAmount)} · {formatDigits(row.createdAt.slice(0, 10))} · {formatDigits(row.reason)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text('Payment amount (EGP)')}
            <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} max={selected?.availableAmount ?? due} required disabled={busy} />
          </label>
          <label>
            {text('Payment note')}
            <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required disabled={busy} />
          </label>
          <p className="inventory-note">{text('This only allocates a previously recorded cash outflow. It does not create or change cash.')}</p>
          <Button type="submit" disabled={busy || !selected || !amount || !reason.trim()}>{text(busy ? 'Saving…' : 'Record payment')}</Button>
        </form>
      )}
    </section>
  );
}

function keyOf(row: PurchaseCashMovementOption) {
  return `${row.sourceType}:${row.movementId}:${row.shiftId ?? ''}`;
}
