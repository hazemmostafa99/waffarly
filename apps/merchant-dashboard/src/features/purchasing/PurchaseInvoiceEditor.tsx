import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { cacheStockItem, stockUnitOptions } from '../inventory/stock-unit-options.js';
import { StockItemPicker, WarehousePicker } from '../inventory/components/InventoryPickers.js';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Input, useLocale } from '@waffarly/ui';
import type {
  CreatePurchaseInvoiceRequest,
  PurchaseInvoice,
  PurchaseSupplier,
  StockCondition,
  StockItem,
} from '@waffarly/contracts';
import { isPositiveStockQuantity } from '@waffarly/contracts';
import type { InvoiceLineDraft } from './purchasing.types.js';
import type { SupplierFields } from './purchasing.types.js';
import { SupplierEditor } from './SupplierEditor.js';
import { apiRequest } from '../../lib/api-client.js';
import { InventoryCard } from '../inventory/InventoryCard.js';
function emptyLine(): InvoiceLineDraft {
  return {
    key: crypto.randomUUID(),
    stockItemId: '',
    condition: 'available',
    quantity: '1',
    unitCode: '',
  };
}

type InvoiceRecovery = {
  version: 1;
  requestId: string;
  invoiceId: string | null;
  revision: number | null;
  step: 1 | 2;
  supplierId: string;
  supplierInvoiceNumber: string;
  warehouseId: string;
  lines: InvoiceLineDraft[];
};

function readRecovery(storageKey: string, invoice: PurchaseInvoice | null): InvoiceRecovery | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const value = JSON.parse(stored) as InvoiceRecovery;
    if (
      value.version !== 1 ||
      typeof value.requestId !== 'string' ||
      value.invoiceId !== (invoice?.id ?? null) ||
      value.revision !== (invoice?.revision ?? null) ||
      (value.step !== 1 && value.step !== 2) ||
      !Array.isArray(value.lines)
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function PurchaseInvoiceEditor({
  invoice,
  busy,
  error,
  errorDetails,
  text,
  formatDigits,
  draftStorageKey,
  onClearError,
  onClose,
  onSave,
}: {
  invoice: PurchaseInvoice | null;
  busy: boolean;
  error: string;
  errorDetails: string;
  text: (value: string) => string;
  formatDigits: (value: string) => string;
  draftStorageKey: string;
  onClearError: () => void;
  onClose: () => void;
  onSave: (
    fields: Omit<CreatePurchaseInvoiceRequest, 'requestId'>,
    requestId: string,
    revision?: number,
    reviewAfterSave?: boolean,
  ) => void;
}) {
  const [recovery] = useState(() => readRecovery(draftStorageKey, invoice));
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(Boolean(recovery));
  const [step, setStep] = useState<1 | 2>(recovery?.step ?? 1);
  const [requestId, setRequestId] = useState(() => recovery?.requestId ?? crypto.randomUUID());
  const [supplierId, setSupplierId] = useState(recovery?.supplierId ?? invoice?.supplierId ?? '');
  const [items, setItems] = useState<StockItem[]>([]);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(
    recovery?.supplierInvoiceNumber ?? invoice?.supplierInvoiceNumber ?? '',
  );
  const [warehouseId, setWarehouseId] = useState(
    recovery?.warehouseId ?? invoice?.warehouseId ?? '',
  );
  const [lines, setLines] = useState<InvoiceLineDraft[]>(
    () =>
      recovery?.lines ??
      invoice?.lines.map((line) => ({
        key: line.id,
        stockItemId: line.stockItemId,
        condition: line.condition,
        quantity: line.quantity,
        unitCode: line.unitCode,
      })) ?? [emptyLine()],
  );
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { errorText } = useLocale();
  const [creatingSupplier, setCreatingSupplier] = useState<string | null>(null);
  const [supplierBusy, setSupplierBusy] = useState(false);
  const [supplierError, setSupplierError] = useState('');
  const supplierSaving = useRef(false);
  const skipNextRecoveryWrite = useRef(false);

  useEffect(() => {
    if (skipNextRecoveryWrite.current) {
      skipNextRecoveryWrite.current = false;
      return;
    }
    try {
      const draft: InvoiceRecovery = {
        version: 1,
        requestId,
        invoiceId: invoice?.id ?? null,
        revision: invoice?.revision ?? null,
        step,
        supplierId,
        supplierInvoiceNumber,
        warehouseId,
        lines,
      };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Draft editing remains available when browser storage is disabled.
    }
  }, [
    draftStorageKey,
    invoice?.id,
    invoice?.revision,
    lines,
    requestId,
    step,
    supplierId,
    supplierInvoiceNumber,
    warehouseId,
  ]);

  function discardRecovery() {
    skipNextRecoveryWrite.current = true;
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore unavailable storage and reset the editor in memory.
    }
    setShowRecoveryNotice(false);
    setRequestId(crypto.randomUUID());
    setStep(1);
    setSupplierId(invoice?.supplierId ?? '');
    setSupplierInvoiceNumber(invoice?.supplierInvoiceNumber ?? '');
    setWarehouseId(invoice?.warehouseId ?? '');
    setLines(
      invoice?.lines.map((line) => ({
        key: line.id,
        stockItemId: line.stockItemId,
        condition: line.condition,
        quantity: line.quantity,
        unitCode: line.unitCode,
      })) ?? [emptyLine()],
    );
    setFieldErrors({});
    setFormError('');
    onClearError();
  }
  async function createSupplier(fields: SupplierFields, requestId?: string) {
    if (supplierSaving.current) return;
    supplierSaving.current = true;
    setSupplierBusy(true);
    setSupplierError('');
    try {
      const supplier = await apiRequest<PurchaseSupplier>('/owner/purchasing/suppliers', {
        method: 'POST',
        body: JSON.stringify({ ...fields, requestId }),
      });
      setSupplierId(supplier.id);
      onClearError();
      setCreatingSupplier(null);
    } catch (cause) {
      setSupplierError(
        cause instanceof Error ? errorText(cause.message) : text('Could not save the supplier.'),
      );
    } finally {
      supplierSaving.current = false;
      setSupplierBusy(false);
    }
  }
  function updateLine(key: string, change: Partial<InvoiceLineDraft>) {
    onClearError();
    setFormError('');
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...change };
        return next;
      }),
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    onClearError();
    if (!supplierId || !warehouseId) {
      setStep(1);
      setFieldErrors({
        supplierId: supplierId ? '' : text('Choose a supplier.'),
        warehouseId: warehouseId ? '' : text('Choose a warehouse.'),
      });
      return;
    }
    const nextErrors: Record<string, string> = {};
    for (const line of lines) {
      if (!line.stockItemId) nextErrors[`stockItem:${line.key}`] = text('Choose a stock item.');
      if (!isPositiveStockQuantity(line.quantity.trim()))
        nextErrors[`quantity:${line.key}`] = text('Enter a quantity greater than zero.');
      if (!line.unitCode) nextErrors[`unit:${line.key}`] = text('Choose a unit.');
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    if (
      new Set(lines.map((line) => `${line.stockItemId}:${line.condition}`)).size !== lines.length
    ) {
      setFormError(text('Invoice lines cannot repeat the same item and condition.'));
      return;
    }
    const fields = {
      supplierId,
      supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
      warehouseId,
      lines: lines.map(({ stockItemId, condition, quantity, unitCode }) => ({
        stockItemId,
        condition,
        quantity: quantity.trim(),
        unitCode,
      })),
    };
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    onSave(fields, requestId, invoice?.revision, submitter?.getAttribute('value') !== 'draft');
  }
  return (
    <>
      <div className="inventory-purchase-workspace">
        {showRecoveryNotice && (
          <div className="inventory-recovery" role="status">
            <span>{text('Your unsaved purchase was restored in this browser.')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={discardRecovery}
            >
              {text('Discard recovered changes')}
            </Button>
          </div>
        )}
        <InventoryCard
          title={text(invoice ? 'Purchase invoice details' : 'New purchase details')}
          description={text(
            'Enter the supplier, destination warehouse, and quantities actually received.',
          )}
        >
          <form
            className="inventory-editor inventory-purchase-editor inventory-purchase-page-form"
            onSubmit={(event) => {
              if (step === 1 || busy || creatingSupplier !== null) {
                event.preventDefault();
                return;
              }
              submit(event);
            }}
          >
            <ol className="inventory-flow" aria-label={text('Purchase progress')}>
              <li aria-current={step === 1 ? 'step' : undefined}>
                {text('Supplier and warehouse')}
              </li>
              <li aria-current={step === 2 ? 'step' : undefined}>{text('Items and quantities')}</li>
              <li>{text('Review and receive')}</li>
            </ol>
            <fieldset
              className="inventory-form-section inventory-purchase-details"
              hidden={step !== 1}
              disabled={busy}
            >
              <div className="inventory-picker-field">
                <div className="inventory-pack-heading">
                  <span>{text('Supplier')}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setSupplierError('');
                      setCreatingSupplier('');
                    }}
                  >
                    {text('Add supplier')}
                  </Button>
                </div>
                <PagedEntitySelect<PurchaseSupplier>
                  path="/owner/purchasing/suppliers"
                  value={supplierId}
                  label={text('Supplier')}
                  searchMode="combobox"
                  emptyLabel={text('Choose supplier')}
                  onCreate={(name) => {
                    setSupplierError('');
                    setCreatingSupplier(name);
                  }}
                  createLabel={text('Create supplier')}
                  onSelect={(supplier) => {
                    onClearError();
                    setSupplierId(supplier?.id ?? '');
                    setFieldErrors((current) => ({ ...current, supplierId: '' }));
                  }}
                  disabled={busy}
                />
                {fieldErrors.supplierId && (
                  <small className="inventory-field-error" role="alert">
                    {fieldErrors.supplierId}
                  </small>
                )}
              </div>
              <label className="inventory-purchase-invoice-number">
                {text('Supplier invoice number')}{' '}
                <small aria-hidden="true">{text('Optional')}</small>
                <Input
                  aria-label={text('Supplier invoice number')}
                  maxLength={100}
                  value={supplierInvoiceNumber}
                  onChange={(event) => {
                    onClearError();
                    setSupplierInvoiceNumber(event.target.value);
                  }}
                />
              </label>
              <div className="inventory-picker-field inventory-purchase-warehouse-field">
                {text('Warehouse')}
                <WarehousePicker
                  value={warehouseId}
                  label={text('Warehouse')}
                  searchMode="combobox"
                  onSelect={(warehouse) => {
                    onClearError();
                    setWarehouseId(warehouse?.id ?? '');
                    setFieldErrors((current) => ({ ...current, warehouseId: '' }));
                  }}
                  disabled={busy}
                />
                {fieldErrors.warehouseId && (
                  <small className="inventory-field-error" role="alert">
                    {fieldErrors.warehouseId}
                  </small>
                )}
              </div>
            </fieldset>
            <fieldset className="inventory-form-section" hidden={step !== 2} disabled={busy}>
              <legend>{text('Items and quantities')}</legend>
              {lines.map((line, index) => {
                const item = items.find((candidate) => candidate.id === line.stockItemId);
                return (
                  <fieldset className="inventory-opening-line" key={line.key}>
                    <legend>
                      {text('Line')} {formatDigits(String(index + 1))}
                    </legend>
                    <div className="inventory-picker-field">
                      {text('Stock item')}
                      <StockItemPicker
                        allowCreate
                        value={line.stockItemId}
                        label={text('Stock item')}
                        onResolve={(item) => setItems((current) => cacheStockItem(current, item))}
                        onSelect={(item) => {
                          if (item) setItems((current) => cacheStockItem(current, item));
                          updateLine(line.key, {
                            stockItemId: item?.id ?? '',
                            unitCode: item?.baseUnit ?? '',
                          });
                          setFieldErrors((current) => ({
                            ...current,
                            [`stockItem:${line.key}`]: '',
                            [`unit:${line.key}`]: '',
                          }));
                        }}
                        disabled={busy}
                      />
                      {fieldErrors[`stockItem:${line.key}`] && (
                        <small className="inventory-field-error" role="alert">
                          {fieldErrors[`stockItem:${line.key}`]}
                        </small>
                      )}
                    </div>
                    <label>
                      {text('Stock condition')}
                      <select
                        value={line.condition}
                        onChange={(event) => {
                          updateLine(line.key, {
                            condition: event.target.value as StockCondition,
                          });
                        }}
                      >
                        <option value="available">{text('Available')}</option>
                        <option value="non_sellable">{text('Non-Sellable')}</option>
                      </select>
                    </label>
                    <label>
                      {text('Quantity')}
                      <Input
                        inputMode="decimal"
                        aria-required="true"
                        value={line.quantity}
                        aria-invalid={Boolean(fieldErrors[`quantity:${line.key}`])}
                        onChange={(event) => {
                          updateLine(line.key, { quantity: event.target.value });
                          setFieldErrors((current) => ({
                            ...current,
                            [`quantity:${line.key}`]: '',
                          }));
                        }}
                      />
                      {fieldErrors[`quantity:${line.key}`] && (
                        <small className="inventory-field-error" role="alert">
                          {fieldErrors[`quantity:${line.key}`]}
                        </small>
                      )}
                    </label>
                    <label>
                      {text('Unit')}
                      <select
                        aria-required="true"
                        value={line.unitCode}
                        onChange={(event) => {
                          updateLine(line.key, { unitCode: event.target.value });
                          setFieldErrors((current) => ({ ...current, [`unit:${line.key}`]: '' }));
                        }}
                      >
                        {stockUnitOptions(item).map((option) => (
                          <option key={option.code} value={option.code}>
                            {formatDigits(`${option.name} (${option.code})`)}
                          </option>
                        ))}
                      </select>
                      {fieldErrors[`unit:${line.key}`] && (
                        <small className="inventory-field-error" role="alert">
                          {fieldErrors[`unit:${line.key}`]}
                        </small>
                      )}
                    </label>
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onClearError();
                          setFormError('');
                          setLines((current) =>
                            current.filter((candidate) => candidate.key !== line.key),
                          );
                        }}
                      >
                        {text('Remove line')}
                      </Button>
                    )}
                  </fieldset>
                );
              })}
              <div className="inventory-row-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={lines.length >= 100 || busy}
                  onClick={() => {
                    onClearError();
                    setFormError('');
                    setLines((current) => [...current, emptyLine()]);
                  }}
                >
                  {text('Add line')}
                </Button>
              </div>
            </fieldset>
            {(formError || (step === 2 ? error : '')) && (
              <div className="inventory-error" role="alert">
                <div className="inventory-error-content">
                  <span>{formError || (step === 2 ? error : '')}</span>
                  {!formError && step === 2 && errorDetails && errorDetails !== error && (
                    <details className="inventory-error-details">
                      <summary>{text('View error details')}</summary>
                      <code>{errorDetails}</code>
                    </details>
                  )}
                </div>
              </div>
            )}
            <p className="inventory-note">
              {text(
                step === 1
                  ? 'This invoice is a draft. Saving it does not affect stock.'
                  : 'Save a draft to continue later, or save and review before receiving stock.',
              )}
            </p>
            <footer className="products-dialog-footer">
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                {text('Back to purchases')}
              </Button>
              {step === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    onClearError();
                    setStep(1);
                  }}
                >
                  {text('Back')}
                </Button>
              )}
              {step === 1 ? (
                <Button
                  key="continue"
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    onClearError();
                    if (!supplierId || !warehouseId) {
                      setFormError('');
                      setFieldErrors((current) => ({
                        ...current,
                        supplierId: supplierId ? '' : text('Choose a supplier.'),
                        warehouseId: warehouseId ? '' : text('Choose a warehouse.'),
                      }));
                      return;
                    }
                    setFormError('');
                    setFieldErrors({});
                    setStep(2);
                  }}
                >
                  {text('Continue to items')}
                </Button>
              ) : (
                <>
                  <Button
                    key="save-draft"
                    type="submit"
                    value="draft"
                    variant="outline"
                    disabled={busy}
                  >
                    {text('Save draft')}
                  </Button>
                  <Button key="save-review" type="submit" value="review" disabled={busy}>
                    {text(busy ? 'Saving…' : 'Save and review')}
                  </Button>
                </>
              )}
            </footer>
          </form>
        </InventoryCard>
      </div>
      {creatingSupplier !== null && (
        <SupplierEditor
          supplier={null}
          initialName={creatingSupplier}
          busy={supplierBusy}
          error={supplierError}
          text={text}
          onClose={() => !supplierBusy && setCreatingSupplier(null)}
          onSave={(fields, requestId) => void createSupplier(fields, requestId)}
        />
      )}
    </>
  );
}
