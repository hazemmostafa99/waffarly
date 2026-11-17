import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, Input, useLocale } from '@waffarly/ui';
import type { PurchaseInvoice } from '@waffarly/contracts';
import { apiRequest } from '../../lib/api-client.js';
import { inventoryCopy } from '../inventory/inventory-copy.js';
import { stockDecimalLabel, stockUnitLabel } from '../inventory/stock-unit-options.js';

export function PurchaseInvoiceAdjustmentsPanel({
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
  const [correctionCosts, setCorrectionCosts] = useState<Record<string, string>>({});
  const [correctionReason, setCorrectionReason] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [creditReason, setCreditReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<'correction' | 'return' | null>(null);
  const [error, setError] = useState('');
  const canCorrectPrices = invoice.lines.some((line) => line.unitCost !== null);
  const hasReturnableQuantity = invoice.lines.some(
    (line) => Number(line.quantity) > Number(line.returnedQuantity ?? 0),
  );

  useEffect(() => {
    setCorrectionCosts(
      Object.fromEntries(
        invoice.lines.map((line) => [line.id, line.correctedUnitCost ?? line.unitCost ?? '']),
      ),
    );
  }, [invoice.id, invoice.corrections, invoice.lines]);

  const selectedCreditLines = useMemo(
    () =>
      invoice.lines.flatMap((line) => {
        const quantity = (returnQuantities[line.id] ?? '').trim();
        const creditAmount = (creditAmounts[line.id] ?? '').trim();
        return quantity && creditAmount && Number(quantity) > 0 && parseCents(creditAmount) > 0n
          ? [{ invoiceLineId: line.id, quantity, creditAmount }]
          : [];
      }),
    [creditAmounts, invoice.lines, returnQuantities],
  );
  const creditTotal = selectedCreditLines.reduce(
    (sum, line) => sum + parseCents(line.creditAmount),
    0n,
  );

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = invoice.lines.flatMap((line) => {
      const value = correctionCosts[line.id]?.trim() ?? '';
      const current = line.correctedUnitCost ?? line.unitCost ?? '';
      return value && value !== current ? [{ invoiceLineId: line.id, unitCost: value }] : [];
    });
    if (!lines.length || !correctionReason.trim() || busy) return;
    await submitCommand(
      `/owner/purchasing/invoices/${invoice.id}/corrections`,
      {
        requestId: crypto.randomUUID(),
        reason: correctionReason.trim(),
        lines,
      },
      () => setCorrectionReason(''),
    );
  }

  async function submitCreditNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCreditLines.length || !creditReason.trim() || creditTotal <= 0n || busy) return;
    await submitCommand(
      `/owner/purchasing/invoices/${invoice.id}/credit-notes`,
      {
        requestId: crypto.randomUUID(),
        reason: creditReason.trim(),
        amount: formatCents(creditTotal),
        lines: selectedCreditLines,
      },
      () => {
        setCreditReason('');
        setReturnQuantities({});
        setCreditAmounts({});
      },
    );
  }

  async function submitCommand(path: string, body: unknown, reset: () => void) {
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      await apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
      const refreshed = await apiRequest<PurchaseInvoice>(
        `/owner/purchasing/invoices/${invoice.id}`,
      );
      onInvoiceChange(refreshed);
      reset();
      setOperation(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not save this invoice adjustment.'),
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <section className="invoice-adjustments-section">
      <div className="invoice-operation-choices">
        <button
          type="button"
          disabled={busy || !canCorrectPrices}
          aria-pressed={operation === 'correction'}
          onClick={() => {
            setOperation(operation === 'correction' ? null : 'correction');
            setError('');
          }}
        >
          <strong>{text('Correct invoice prices')}</strong>
          <span>{text('Change recorded prices without changing received quantities.')}</span>
          {!canCorrectPrices && (
            <small>{text('No recorded unit costs are available to correct.')}</small>
          )}
        </button>
        <button
          type="button"
          disabled={busy || !hasReturnableQuantity}
          aria-pressed={operation === 'return'}
          onClick={() => {
            setOperation(operation === 'return' ? null : 'return');
            setError('');
          }}
        >
          <strong>{text('Return goods to supplier')}</strong>
          <span>
            {text('Return quantities and record supplier credit, without a cash refund.')}
          </span>
          {!hasReturnableQuantity && (
            <small>{text('No received quantities remain to return.')}</small>
          )}
        </button>
      </div>
      {error && (
        <p className="inventory-error" role="alert">
          {error}
        </p>
      )}
      {operation === 'correction' && (
        <form
          className="inventory-payment-form invoice-operation-form"
          onSubmit={(event) => void submitCorrection(event)}
        >
          <h4>{text('Correct invoice prices')}</h4>
          <p className="inventory-note">
            {text(
              'This keeps the original invoice intact. Future sales use the corrected cost only when this invoice is still the current cost source.',
            )}
          </p>
          {invoice.lines.map((line) => (
            <label key={line.id} className="invoice-correction-line">
              <span>
                {formatDigits(
                  `${line.stockItemName} · ${stockDecimalLabel(line.quantity)} ${stockUnitLabel(line.unitCode, locale, line.unitName)}`,
                )}
              </span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={correctionCosts[line.id] ?? ''}
                onChange={(event) =>
                  setCorrectionCosts((current) => ({ ...current, [line.id]: event.target.value }))
                }
                disabled={busy || line.unitCost === null}
              />
              <small>
                {text('Current corrected unit cost')}:{' '}
                {formatDigits(line.correctedUnitCost ?? line.unitCost ?? text('Unknown'))}
              </small>
            </label>
          ))}
          <label>
            {text('Correction reason')}
            <Input
              value={correctionReason}
              onChange={(event) => setCorrectionReason(event.target.value)}
              maxLength={500}
              required
              disabled={busy}
            />
          </label>
          <Button
            type="submit"
            disabled={
              busy ||
              !correctionReason.trim() ||
              !invoice.lines.some(
                (line) =>
                  (correctionCosts[line.id] ?? '') !==
                  (line.correctedUnitCost ?? line.unitCost ?? ''),
              )
            }
          >
            {text(busy ? 'Saving…' : 'Record correction')}
          </Button>
        </form>
      )}
      {operation === 'return' && (
        <form
          className="inventory-payment-form invoice-operation-form"
          onSubmit={(event) => void submitCreditNote(event)}
        >
          <h4>{text('Return goods to supplier')}</h4>
          <p className="inventory-note">
            {text(
              'This removes the returned quantity from the purchase warehouse and records a supplier credit. It does not create a cash refund.',
            )}
          </p>
          {invoice.lines.map((line) => {
            const remaining = Math.max(
              0,
              Number(line.quantity) - Number(line.returnedQuantity ?? 0),
            );
            if (remaining <= 0) return null;
            return (
              <div key={line.id} className="inventory-payment-line">
                <strong>{formatDigits(line.stockItemName)}</strong>
                <small>
                  {text('Received')}:{' '}
                  {formatDigits(
                    `${stockDecimalLabel(line.quantity)} ${stockUnitLabel(line.unitCode, locale, line.unitName)}`,
                  )}{' '}
                  · {text('Previously returned')}:{' '}
                  {formatDigits(stockDecimalLabel(line.returnedQuantity ?? '0'))}
                </small>
                <label>
                  {text('Quantity to return')}
                  <Input
                    type="number"
                    min="0"
                    max={remaining}
                    step="0.000001"
                    inputMode="decimal"
                    value={returnQuantities[line.id] ?? ''}
                    onChange={(event) =>
                      setReturnQuantities((current) => ({
                        ...current,
                        [line.id]: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />
                </label>
                <label>
                  {text('Supplier credit (EGP)')}
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={creditAmounts[line.id] ?? ''}
                    onChange={(event) =>
                      setCreditAmounts((current) => ({ ...current, [line.id]: event.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
              </div>
            );
          })}
          <label>
            {text('Supplier credit reason')}
            <Input
              value={creditReason}
              onChange={(event) => setCreditReason(event.target.value)}
              maxLength={500}
              required
              disabled={busy}
            />
          </label>
          <p>
            <strong>{text('Credit note total')}:</strong> {formatDigits(formatCents(creditTotal))}
          </p>
          <Button
            type="submit"
            disabled={busy || !selectedCreditLines.length || !creditReason.trim()}
          >
            {text(busy ? 'Saving…' : 'Record supplier return')}
          </Button>
        </form>
      )}
      {((invoice.corrections?.length ?? 0) > 0 || (invoice.creditNotes?.length ?? 0) > 0) && (
        <details className="inventory-section-details invoice-adjustment-history">
          <summary>{text('Correction and return history')}</summary>{' '}
          {(invoice.corrections?.length ?? 0) > 0 && (
            <div>
              <h4>{text('Correction history')}</h4>
              <ul>
                {invoice.corrections?.map((row) => (
                  <li key={row.id}>
                    <strong>{formatDigits(row.amountDelta)}</strong> · {formatDigits(row.reason)} ·{' '}
                    {formatDigits(row.issuedAt.slice(0, 10))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(invoice.creditNotes?.length ?? 0) > 0 && (
            <div>
              <h4>{text('Supplier credit notes')}</h4>
              <ul>
                {invoice.creditNotes?.map((row) => (
                  <li key={row.id}>
                    <strong>
                      {formatDigits(row.creditNumber)} · {formatDigits(row.amount)}
                    </strong>{' '}
                    · {formatDigits(row.reason)} · {text('Returned quantity')}:{' '}
                    {formatDigits(row.returnedQuantity)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}
    </section>
  );
}

function parseCents(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return 0n;
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function formatCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}
