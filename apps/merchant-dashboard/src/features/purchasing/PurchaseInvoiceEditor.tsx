import './purchase-entry.css';
import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import {
  cacheStockItem,
  stockUnitOptions,
  stockUnitLabel,
} from '../inventory/stock-unit-options.js';
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
import {
  calculatePurchaseInvoiceAmounts,
  resolvePurchaseInvoiceDiscount,
  calculatePurchaseInvoiceLineTotal,
  isNonNegativePurchaseAmount,
  isPositiveStockQuantity,
  isPositivePurchaseUnitCost,
} from '@waffarly/contracts';
import type { InvoiceLineDraft } from './purchasing.types.js';
import type { SupplierFields } from './purchasing.types.js';
import { SupplierEditor } from './SupplierEditor.js';
import { apiRequest } from '../../lib/api-client.js';
import { Icon } from '../../Icons.js';
import { CreateStockItemDialog } from '../inventory/components/CreateStockItemDialog.js';
function emptyLine(): InvoiceLineDraft {
  return {
    key: crypto.randomUUID(),
    stockItemId: '',
    condition: 'available',
    quantity: '1',
    unitCode: '',
    unitCost: '',
  };
}

type InvoiceRecovery = {
  version: 1 | 2 | 3 | 4;
  invoiceDate?: string;
  notes?: string;
  discountType?: 'amount' | 'percentage';
  discountValue?: string;
  requestId: string;
  invoiceId: string | null;
  revision: number | null;
  step: 1 | 2;
  supplierId: string;
  supplierInvoiceNumber: string;
  warehouseId: string;
  discountAmount?: string;
  shippingAmount?: string;
  lines: InvoiceLineDraft[];
};

function readRecovery(storageKey: string, invoice: PurchaseInvoice | null): InvoiceRecovery | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const value = JSON.parse(stored) as InvoiceRecovery;
    if (
      (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4) ||
      typeof value.requestId !== 'string' ||
      value.invoiceId !== (invoice?.id ?? null) ||
      value.revision !== (invoice?.revision ?? null) ||
      (value.step !== 1 && value.step !== 2) ||
      !Array.isArray(value.lines)
    ) {
      return null;
    }
    return {
      ...value,
      version: 4,
      discountAmount: value.discountAmount ?? '0.00',
      shippingAmount: value.shippingAmount ?? '0.00',
      lines: value.lines.map((line) => ({ ...line, unitCost: line.unitCost ?? '' })),
    };
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
  const [invoiceDate, setInvoiceDate] = useState(
    recovery?.invoiceDate ??
      invoice?.invoiceDate ??
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
  );
  const [notes, setNotes] = useState(recovery?.notes ?? invoice?.notes ?? '');
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>(
    recovery?.discountType ?? invoice?.discountType ?? 'amount',
  );
  const [creatingItem, setCreatingItem] = useState(false);
  const [requestId, setRequestId] = useState(() => recovery?.requestId ?? crypto.randomUUID());
  const [supplierId, setSupplierId] = useState(recovery?.supplierId ?? invoice?.supplierId ?? '');
  const [items, setItems] = useState<StockItem[]>([]);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(
    recovery?.supplierInvoiceNumber ?? invoice?.supplierInvoiceNumber ?? '',
  );
  const [warehouseId, setWarehouseId] = useState(
    recovery?.warehouseId ?? invoice?.warehouseId ?? '',
  );
  const [discountValue, setDiscountValue] = useState(
    recovery?.discountValue ??
      recovery?.discountAmount ??
      invoice?.discountValue ??
      invoice?.discountAmount ??
      '0.00',
  );
  const [shippingAmount, setShippingAmount] = useState(
    recovery?.shippingAmount ?? invoice?.shippingAmount ?? '0.00',
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
        unitCost: line.unitCost ?? '',
      })) ?? [emptyLine()],
  );
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { errorText, locale } = useLocale();
  const [creatingSupplier, setCreatingSupplier] = useState<string | null>(null);
  const [supplierBusy, setSupplierBusy] = useState(false);
  const [supplierError, setSupplierError] = useState('');
  const supplierSaving = useRef(false);
  const skipNextRecoveryWrite = useRef(false);
  const discountAmount =
    resolvePurchaseInvoiceDiscount(lines, discountType, discountValue.trim()) ?? 'invalid';
  const invoiceAmounts = calculatePurchaseInvoiceAmounts(
    lines.map(({ quantity, unitCost }) => ({
      quantity: quantity.trim(),
      unitCost: unitCost.trim(),
    })),
    discountAmount.trim(),
    shippingAmount.trim(),
  );

  useEffect(() => {
    if (skipNextRecoveryWrite.current) {
      skipNextRecoveryWrite.current = false;
      return;
    }
    try {
      const draft: InvoiceRecovery = {
        version: 4,
        requestId,
        invoiceId: invoice?.id ?? null,
        revision: invoice?.revision ?? null,
        step: 2,
        invoiceDate,
        notes,
        discountType,
        discountValue,
        supplierId,
        supplierInvoiceNumber,
        warehouseId,
        discountAmount,
        shippingAmount,
        lines,
      };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Draft editing remains available when browser storage is disabled.
    }
  }, [
    draftStorageKey,
    discountAmount,
    invoice?.id,
    invoice?.revision,
    lines,
    requestId,
    invoiceDate,
    notes,
    discountType,
    discountValue,
    supplierId,
    supplierInvoiceNumber,
    shippingAmount,
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
    setInvoiceDate(
      invoice?.invoiceDate ??
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Cairo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
    );
    setNotes(invoice?.notes ?? '');
    setDiscountType(invoice?.discountType ?? 'amount');
    setSupplierId(invoice?.supplierId ?? '');
    setSupplierInvoiceNumber(invoice?.supplierInvoiceNumber ?? '');
    setWarehouseId(invoice?.warehouseId ?? '');
    setDiscountValue(invoice?.discountValue ?? invoice?.discountAmount ?? '0.00');
    setShippingAmount(invoice?.shippingAmount ?? '0.00');
    setLines(
      invoice?.lines.map((line) => ({
        key: line.id,
        stockItemId: line.stockItemId,
        condition: line.condition,
        quantity: line.quantity,
        unitCode: line.unitCode,
        unitCost: line.unitCost ?? '',
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
      setFieldErrors({
        supplierId: supplierId ? '' : text('Choose a supplier.'),
        warehouseId: warehouseId ? '' : text('Choose a warehouse.'),
      });
      return;
    }
    const nextErrors: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate))
      nextErrors.invoiceDate = text('Choose an invoice date.');
    for (const line of lines) {
      if (!line.stockItemId) nextErrors[`stockItem:${line.key}`] = text('Choose a stock item.');
      if (!isPositiveStockQuantity(line.quantity.trim()))
        nextErrors[`quantity:${line.key}`] = text('Enter a quantity greater than zero.');
      if (!line.unitCode) nextErrors[`unit:${line.key}`] = text('Choose a unit.');
      if (!isPositivePurchaseUnitCost(line.unitCost.trim()))
        nextErrors[`unitCost:${line.key}`] = text('Enter a unit cost greater than zero.');
    }
    if (
      !isNonNegativePurchaseAmount(discountValue.trim()) ||
      (discountType === 'percentage' && Number(discountValue) > 100)
    ) {
      nextErrors.discountAmount = text(
        discountType === 'percentage'
          ? 'Enter a percentage between 0 and 100.'
          : 'Enter a valid discount amount in EGP.',
      );
    }
    if (!isNonNegativePurchaseAmount(shippingAmount.trim())) {
      nextErrors.shippingAmount = text('Enter a valid shipping amount in EGP.');
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const nextAmounts = calculatePurchaseInvoiceAmounts(
      lines.map(({ quantity, unitCost }) => ({
        quantity: quantity.trim(),
        unitCost: unitCost.trim(),
      })),
      discountAmount.trim(),
      shippingAmount.trim(),
    );
    if (!nextAmounts) {
      setFormError(
        text('Discount cannot exceed the subtotal, and the invoice total must be valid.'),
      );
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
      invoiceDate,
      notes: notes.trim(),
      discountType,
      discountValue: discountValue.trim(),
      supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
      warehouseId,
      discountAmount: discountAmount.trim(),
      shippingAmount: shippingAmount.trim(),
      lines: lines.map(({ stockItemId, condition, quantity, unitCode, unitCost }) => ({
        stockItemId,
        condition,
        quantity: quantity.trim(),
        unitCode,
        unitCost: unitCost.trim(),
      })),
    };
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    onSave(fields, requestId, invoice?.revision, submitter?.getAttribute('value') !== 'draft');
  }
  function addItem(item: StockItem | null) {
    if (!item) return;
    if (lines.some((line) => line.stockItemId === item.id && line.condition === 'available')) {
      setFormError(text('This item is already on the invoice. Edit its existing line.'));
      return;
    }
    setItems((current) => cacheStockItem(current, item));
    onClearError();
    setFormError('');
    setLines((current) => {
      const blank = current.find((line) => !line.stockItemId);
      if (blank)
        return current.map((line) =>
          line.key === blank.key
            ? { ...line, stockItemId: item.id, unitCode: item.baseUnit }
            : line,
        );
      if (current.length >= 100) return current;
      return [...current, { ...emptyLine(), stockItemId: item.id, unitCode: item.baseUnit }];
    });
  }
  function fieldError(key: string) {
    return fieldErrors[key] ? (
      <small className="inventory-field-error" role="alert">
        {fieldErrors[key]}
      </small>
    ) : null;
  }
  function unitEquation(item: StockItem | undefined, unitCode: string) {
    if (!item || !unitCode) return '—';
    const pack = item.units.find((unit) => unit.code === unitCode);
    const factor =
      pack?.baseQuantity ??
      (unitCode === item.baseUnit ? '1' : unitCode === 'kg' || unitCode === 'l' ? '1000' : '0.001');
    return `1 ${stockUnitLabel(unitCode, locale, pack?.name)} = ${factor} ${stockUnitLabel(item.baseUnit, locale)}`;
  }
  function money(value: string | null | undefined) {
    if (!value) return '—';
    const [whole, fraction = '00'] = value.split('.');
    return formatDigits(
      `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`,
    );
  }
  const isEmptyInvoice = lines.every((line) => !line.stockItemId && !line.unitCost.trim());
  const subtotal =
    calculatePurchaseInvoiceAmounts(lines)?.subtotalAmount ?? (isEmptyInvoice ? '0.00' : null);
  const itemLimit = lines.length >= 100 && lines.every((line) => line.stockItemId);
  const editingDisabled = busy || creatingSupplier !== null || creatingItem;
  return (
    <>
      <form
        className="purchase-entry"
        noValidate
        onSubmit={(event) => {
          if (editingDisabled) {
            event.preventDefault();
            return;
          }
          submit(event);
        }}
      >
        <header className="purchase-entry-heading">
          <div className="purchase-entry-title">
            <span className="purchase-entry-icon">
              <Icon name="file" />
            </span>
            <div>
              <div className="purchase-entry-title-row">
                <h1>{text(invoice ? 'Edit draft' : 'New purchase invoice')}</h1>
                <span className="purchase-entry-status">{text('Draft')}</span>
              </div>
              <p>{text('Enter a supplier invoice and review it before receiving stock.')}</p>
            </div>
          </div>
          <div className="purchase-entry-actions">
            <Button type="submit" value="review" disabled={editingDisabled}>
              <Icon name="check" />
              {text(busy ? 'Saving…' : 'Save and review')}
            </Button>
            <Button type="submit" value="draft" variant="outline" disabled={editingDisabled}>
              {text('Save draft')}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              {text('Cancel')}
            </Button>
          </div>
        </header>
        {showRecoveryNotice && (
          <div className="purchase-entry-recovery" role="status">
            <Icon name="check" />
            <span>{text('Your unsaved invoice was restored.')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={editingDisabled}
              onClick={discardRecovery}
            >
              {text('Discard recovery')}
            </Button>
          </div>
        )}
        {(formError || error) && (
          <div className="inventory-error" role="alert">
            <div className="inventory-error-content">
              <span>{formError || error}</span>
              {!formError && errorDetails && errorDetails !== error && (
                <details className="inventory-error-details">
                  <summary>{text('View error details')}</summary>
                  <code>{errorDetails}</code>
                </details>
              )}
            </div>
          </div>
        )}
        <div className="purchase-entry-layout">
          <div className="purchase-entry-main">
            <fieldset
              className="purchase-entry-details purchase-entry-panel"
              disabled={editingDisabled}
            >
              <legend className="sr-only">{text('Supplier and warehouse')}</legend>
              <div className="purchase-entry-field">
                <span>
                  {text('Supplier')} <b className="purchase-entry-required">*</b>
                </span>
                <PagedEntitySelect<PurchaseSupplier>
                  path="/owner/purchasing/suppliers"
                  value={supplierId}
                  label={text('Supplier')}
                  searchMode="combobox"
                  emptyLabel={text('Choose supplier')}
                  disabled={editingDisabled}
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
                />
                {fieldError('supplierId')}
              </div>
              <div className="purchase-entry-field">
                <span>
                  {text('Warehouse')} <b className="purchase-entry-required">*</b>
                </span>
                <WarehousePicker
                  value={warehouseId}
                  label={text('Warehouse')}
                  disabled={editingDisabled}
                  onSelect={(warehouse) => {
                    onClearError();
                    setWarehouseId(warehouse?.id ?? '');
                    setFieldErrors((current) => ({ ...current, warehouseId: '' }));
                  }}
                />
                {fieldError('warehouseId')}
              </div>
              <label className="purchase-entry-field">
                <span>
                  {text('Invoice date')} <b className="purchase-entry-required">*</b>
                </span>
                <Input
                  dir="ltr"
                  type="date"
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.invoiceDate)}
                  value={invoiceDate}
                  onChange={(event) => {
                    setInvoiceDate(event.target.value);
                    setFieldErrors((current) => ({ ...current, invoiceDate: '' }));
                    onClearError();
                  }}
                />
                {fieldError('invoiceDate')}
              </label>
              <label className="purchase-entry-field">
                <span>
                  {text('Supplier invoice number')} <small>{text('Optional')}</small>
                </span>
                <Input
                  maxLength={100}
                  value={supplierInvoiceNumber}
                  onChange={(event) => {
                    setSupplierInvoiceNumber(event.target.value);
                    onClearError();
                  }}
                />
              </label>
            </fieldset>
            <section
              className="purchase-entry-items purchase-entry-panel"
              aria-labelledby="purchase-entry-items-title"
            >
              <div className="purchase-entry-items-heading">
                <h2 id="purchase-entry-items-title">
                  <Icon name="box" />
                  {text('Items')} (
                  {formatDigits(String(lines.filter((line) => line.stockItemId).length))})
                </h2>
                <div className="purchase-entry-add-picker">
                  <StockItemPicker
                    value=""
                    label={text('Search and add a stock item')}
                    emptyLabel={text('Search for an item to add…')}
                    allowCreate
                    disabled={editingDisabled || itemLimit}
                    onSelect={addItem}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={editingDisabled || itemLimit}
                  onClick={() => setCreatingItem(true)}
                >
                  <Icon name="plus" />
                  {text('Create stock item')}
                </Button>
              </div>
              <div className="purchase-entry-table-scroll">
                <table className="purchase-entry-table">
                  <colgroup>
                    <col className="purchase-col-number" />
                    <col className="purchase-col-item" />
                    <col className="purchase-col-quantity" />
                    <col className="purchase-col-unit" />
                    <col className="purchase-col-conversion" />
                    <col className="purchase-col-cost" />
                    <col className="purchase-col-total" />
                    <col className="purchase-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">{text('Stock item')}</th>
                      <th scope="col">{text('Quantity')}</th>
                      <th scope="col">{text('Purchase unit')}</th>
                      <th scope="col">{text('Conversion factor')}</th>
                      <th scope="col">
                        {text('Unit cost')}
                        <small>{text('EGP')}</small>
                      </th>
                      <th scope="col">
                        {text('Line subtotal')}
                        <small>{text('EGP')}</small>
                      </th>
                      <th scope="col">
                        <span className="sr-only">{text('Remove line')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => {
                      const item = items.find((candidate) => candidate.id === line.stockItemId);
                      return (
                        <tr key={line.key}>
                          <td className="purchase-entry-line-number">
                            {formatDigits(String(index + 1))}
                          </td>
                          <td className="purchase-entry-item-cell">
                            <StockItemPicker
                              value={line.stockItemId}
                              label={`${text('Stock item')} ${index + 1}`}
                              showBaseUnit={false}
                              floatingMenu
                              allowCreate
                              disabled={editingDisabled}
                              onResolve={(resolved) =>
                                setItems((current) => cacheStockItem(current, resolved))
                              }
                              onSelect={(selected) => {
                                if (selected)
                                  setItems((current) => cacheStockItem(current, selected));
                                updateLine(line.key, {
                                  stockItemId: selected?.id ?? '',
                                  unitCode: selected?.baseUnit ?? '',
                                });
                                setFieldErrors((current) => ({
                                  ...current,
                                  [`stockItem:${line.key}`]: '',
                                  [`unit:${line.key}`]: '',
                                }));
                              }}
                            />
                            {fieldError(`stockItem:${line.key}`)}
                            {line.condition === 'non_sellable' && (
                              <small className="purchase-entry-condition-badge">
                                {text('Non-Sellable')}
                              </small>
                            )}
                          </td>
                          <td>
                            <Input
                              aria-label={`${text('Quantity')} ${index + 1}`}
                              aria-required="true"
                              aria-invalid={Boolean(fieldErrors[`quantity:${line.key}`])}
                              inputMode="decimal"
                              disabled={editingDisabled}
                              value={line.quantity}
                              onChange={(event) => {
                                updateLine(line.key, { quantity: event.target.value });
                                setFieldErrors((current) => ({
                                  ...current,
                                  [`quantity:${line.key}`]: '',
                                }));
                              }}
                            />
                            {fieldError(`quantity:${line.key}`)}
                          </td>
                          <td>
                            <select
                              aria-label={`${text('Purchase unit')} ${index + 1}`}
                              aria-required="true"
                              aria-invalid={Boolean(fieldErrors[`unit:${line.key}`])}
                              disabled={editingDisabled}
                              value={line.unitCode}
                              onChange={(event) => {
                                updateLine(line.key, { unitCode: event.target.value });
                                setFieldErrors((current) => ({
                                  ...current,
                                  [`unit:${line.key}`]: '',
                                }));
                              }}
                            >
                              {!item && <option value="">—</option>}
                              {stockUnitOptions(item).map((option) => (
                                <option key={option.code} value={option.code}>
                                  {stockUnitLabel(option.code, locale, option.name)}
                                </option>
                              ))}
                            </select>
                            {fieldError(`unit:${line.key}`)}
                          </td>
                          <td>
                            <span
                              className={`purchase-entry-equation ${item?.units.some((unit) => unit.code === line.unitCode) ? 'is-pack' : ''}`}
                              dir="auto"
                            >
                              {formatDigits(unitEquation(item, line.unitCode))}
                            </span>
                          </td>
                          <td>
                            <Input
                              aria-label={`${text('Unit cost (EGP)')} ${index + 1}`}
                              aria-required="true"
                              aria-invalid={Boolean(fieldErrors[`unitCost:${line.key}`])}
                              inputMode="decimal"
                              disabled={editingDisabled}
                              value={line.unitCost}
                              onChange={(event) => {
                                updateLine(line.key, { unitCost: event.target.value });
                                setFieldErrors((current) => ({
                                  ...current,
                                  [`unitCost:${line.key}`]: '',
                                }));
                              }}
                            />
                            {fieldError(`unitCost:${line.key}`)}
                          </td>
                          <td className="purchase-entry-line-total">
                            <strong dir="ltr">
                              {money(
                                calculatePurchaseInvoiceLineTotal(
                                  line.quantity.trim(),
                                  line.unitCost.trim(),
                                ),
                              )}
                            </strong>
                            {invoiceAmounts &&
                              (invoiceAmounts.discountAmount !== '0.00' ||
                                invoiceAmounts.shippingAmount !== '0.00') && (
                                <details className="purchase-entry-line-allocation">
                                  <summary>{text('Cost breakdown')}</summary>
                                  <small>
                                    {text('Discount share')}:{' '}
                                    {formatDigits(invoiceAmounts.lines[index]!.discountAllocation)}
                                  </small>
                                  <small>
                                    {text('Shipping share')}:{' '}
                                    {formatDigits(invoiceAmounts.lines[index]!.shippingAllocation)}
                                  </small>
                                  <small>
                                    {text('Final line total (EGP)')}:{' '}
                                    {formatDigits(invoiceAmounts.lines[index]!.lineTotal)}
                                  </small>
                                </details>
                              )}
                          </td>
                          <td>
                            <div className="purchase-entry-row-actions">
                              <button
                                className="purchase-entry-remove"
                                type="button"
                                disabled={editingDisabled || lines.length === 1}
                                aria-label={`${text('Remove line')} ${index + 1}`}
                                onClick={() => {
                                  onClearError();
                                  setFormError('');
                                  setLines((current) =>
                                    current.filter((candidate) => candidate.key !== line.key),
                                  );
                                }}
                              >
                                <Icon name="trash" />
                              </button>
                              <label
                                className="purchase-entry-row-condition"
                                title={text('Stock condition')}
                              >
                                <Icon name="more" />
                                <select
                                  aria-label={`${text('Stock condition')} ${index + 1}`}
                                  disabled={editingDisabled}
                                  value={line.condition}
                                  onChange={(event) =>
                                    updateLine(line.key, {
                                      condition: event.target.value as StockCondition,
                                    })
                                  }
                                >
                                  <option value="available">{text('Available')}</option>
                                  <option value="non_sellable">{text('Non-Sellable')}</option>
                                </select>
                              </label>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button
                className="purchase-entry-add-line"
                type="button"
                variant="ghost"
                disabled={editingDisabled || lines.length >= 100}
                onClick={() => {
                  onClearError();
                  setFormError('');
                  setLines((current) => [...current, emptyLine()]);
                }}
              >
                <Icon name="plus" />
                {text('Add line')}
              </Button>
            </section>
            <p className="purchase-entry-footnote">
              <Icon name="file" />
              {text('This invoice is a draft. Saving it does not affect stock.')}
            </p>
          </div>
          <aside
            className="purchase-entry-summary purchase-entry-panel"
            aria-labelledby="purchase-entry-summary-title"
          >
            <h2 id="purchase-entry-summary-title">
              <Icon name="file" />
              {text('Invoice summary')}
            </h2>
            <div className="purchase-entry-summary-row">
              <span>{text('Items subtotal')}</span>
              <strong dir="ltr">
                {money(subtotal)} <small>{text('EGP')}</small>
              </strong>
            </div>
            <fieldset disabled={editingDisabled} className="purchase-entry-summary-fields">
              <legend className="sr-only">{text('Invoice adjustments')}</legend>
              <label className="purchase-entry-field">
                <span>{text('Discount')}</span>
                <div className="purchase-entry-discount">
                  <select
                    aria-label={text('Discount type')}
                    value={discountType}
                    onChange={(event) => {
                      setDiscountType(event.target.value as 'amount' | 'percentage');
                      setDiscountValue('0.00');
                      setFieldErrors((current) => ({ ...current, discountAmount: '' }));
                      setFormError('');
                      onClearError();
                    }}
                  >
                    <option value="amount">{text('EGP')}</option>
                    <option value="percentage">%</option>
                  </select>
                  <Input
                    inputMode="decimal"
                    aria-label={text('Discount value')}
                    aria-invalid={Boolean(fieldErrors.discountAmount)}
                    value={discountValue}
                    onChange={(event) => {
                      setDiscountValue(event.target.value);
                      setFieldErrors((current) => ({ ...current, discountAmount: '' }));
                      setFormError('');
                      onClearError();
                    }}
                  />
                </div>
                {fieldError('discountAmount')}
                {discountType === 'percentage' && (
                  <small>
                    {text('Discount (EGP)')}:{' '}
                    {money(discountAmount === 'invalid' ? null : discountAmount)}
                  </small>
                )}
              </label>
              <label className="purchase-entry-field">
                <span>
                  {text('Shipping cost')} <small>{text('EGP')}</small>
                </span>
                <Input
                  inputMode="decimal"
                  aria-invalid={Boolean(fieldErrors.shippingAmount)}
                  value={shippingAmount}
                  onChange={(event) => {
                    setShippingAmount(event.target.value);
                    setFieldErrors((current) => ({ ...current, shippingAmount: '' }));
                    setFormError('');
                    onClearError();
                  }}
                />
                {fieldError('shippingAmount')}
              </label>
            </fieldset>
            <div className="purchase-entry-grand-total" aria-live="polite">
              <span>{text('Grand total')}</span>
              <strong dir="ltr">
                {money(invoiceAmounts?.totalAmount ?? (isEmptyInvoice ? '0.00' : null))}{' '}
                <small>{text('EGP')}</small>
              </strong>
            </div>
            <p className="purchase-entry-tax-note">
              {text('Taxes are not included in this invoice total yet.')}
            </p>
            <label className="purchase-entry-field purchase-entry-notes">
              <span>
                {text('Notes')} <small>{text('Optional')}</small>
              </span>
              <textarea
                maxLength={2000}
                rows={4}
                disabled={editingDisabled}
                value={notes}
                placeholder={text('Any notes about this invoice…')}
                onChange={(event) => {
                  setNotes(event.target.value);
                  onClearError();
                }}
              />
            </label>
          </aside>
        </div>
      </form>
      {creatingSupplier !== null && (
        <SupplierEditor
          supplier={null}
          initialName={creatingSupplier}
          busy={supplierBusy}
          error={supplierError}
          text={text}
          onClose={() => !supplierBusy && setCreatingSupplier(null)}
          onSave={(fields, supplierRequestId) => void createSupplier(fields, supplierRequestId)}
        />
      )}
      {creatingItem && (
        <CreateStockItemDialog
          initialName=""
          defaultUnit="piece"
          onCreated={addItem}
          onClose={() => setCreatingItem(false)}
        />
      )}
    </>
  );
}
