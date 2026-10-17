import { PagedEntitySelect } from '../../components/PagedEntitySelect.js';
import { cacheStockItem, stockUnitOptions } from '../inventory/stock-unit-options.js';
import { StockItemPicker, WarehousePicker } from '../inventory/components/InventoryPickers.js';
import { useState, type FormEvent } from 'react';
import { Button, Input } from '@waffarly/ui';
import type {
  CreatePurchaseInvoiceRequest,
  PurchaseInvoice,
  PurchaseSupplier,
  StockCondition,
  StockItem,
} from '@waffarly/contracts';
import { isPositiveStockQuantity } from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import type { InvoiceLineDraft } from './purchasing.types.js';
function emptyLine(): InvoiceLineDraft {
  return {
    key: crypto.randomUUID(),
    stockItemId: '',
    condition: 'available',
    quantity: '1',
    unitCode: '',
  };
}

export function PurchaseInvoiceEditor({
  invoice,
  busy,
  error,
  text,
  formatDigits,
  onClose,
  onSave,
}: {
  invoice: PurchaseInvoice | null;
  busy: boolean;
  error: string;
  text: (value: string) => string;
  formatDigits: (value: string) => string;
  onClose: () => void;
  onSave: (
    fields: Omit<CreatePurchaseInvoiceRequest, 'requestId'>,
    requestId: string,
    revision?: number,
  ) => void;
}) {
  const [step, setStep] = useState(1);
  const [requestId] = useState(crypto.randomUUID());
  const [supplierId, setSupplierId] = useState(invoice?.supplierId ?? '');
  const [items, setItems] = useState<StockItem[]>([]);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(
    invoice?.supplierInvoiceNumber ?? '',
  );
  const [warehouseId, setWarehouseId] = useState(invoice?.warehouseId ?? '');
  const [lines, setLines] = useState<InvoiceLineDraft[]>(
    () =>
      invoice?.lines.map((line) => ({
        key: line.id,
        stockItemId: line.stockItemId,
        condition: line.condition,
        quantity: line.quantity,
        unitCode: line.unitCode,
      })) ?? [emptyLine()],
  );
  const [formError, setFormError] = useState('');
  function updateLine(key: string, change: Partial<InvoiceLineDraft>) {
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
    if (
      !supplierId ||
      !warehouseId ||
      lines.some(
        (line) =>
          !line.stockItemId || !isPositiveStockQuantity(line.quantity.trim()) || !line.unitCode,
      )
    ) {
      setFormError(text('Enter the actual received quantity before review.'));
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
    onSave(fields, requestId, invoice?.revision);
  }
  return (
    <DashboardDialog
      title={text(invoice ? 'Edit draft' : 'New purchase invoice')}
      closeLabel={text('Close')}
      onClose={onClose}
      busy={busy}
    >
      <form
        className="products-dialog-body inventory-editor"
        onSubmit={(event) => {
          if (step === 1) {
            event.preventDefault();
            return;
          }
          submit(event);
        }}
      >
        <ol className="inventory-flow" aria-label={text('Purchase progress')}>
          <li aria-current={step === 1 ? 'step' : undefined}>{text('Supplier and warehouse')}</li>
          <li aria-current={step === 2 ? 'step' : undefined}>{text('Items and quantities')}</li>
          <li>{text('Review and receive')}</li>
        </ol>
        <fieldset className="inventory-form-section" hidden={step !== 1} disabled={busy}>
          <div className="inventory-picker-field">
            {text('Supplier')}
            <PagedEntitySelect<PurchaseSupplier>
              path="/owner/purchasing/suppliers"
              value={supplierId}
              label={text('Supplier')}
              onSelect={(supplier) => setSupplierId(supplier?.id ?? '')}
              disabled={busy}
            />
          </div>
          <label>
            {text('Supplier invoice number')}
            <Input
              maxLength={100}
              value={supplierInvoiceNumber}
              onChange={(event) => setSupplierInvoiceNumber(event.target.value)}
            />
          </label>
          <div className="inventory-picker-field">
            {text('Warehouse')}
            <WarehousePicker
              value={warehouseId}
              label={text('Warehouse')}
              onSelect={(warehouse) => setWarehouseId(warehouse?.id ?? '')}
              disabled={busy}
            />
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
                    value={line.stockItemId}
                    label={text('Stock item')}
                    onResolve={(item) => setItems((current) => cacheStockItem(current, item))}
                    onSelect={(item) => {
                      if (item) setItems((current) => cacheStockItem(current, item));
                      updateLine(line.key, {
                        stockItemId: item?.id ?? '',
                        unitCode: item?.baseUnit ?? '',
                      });
                    }}
                    disabled={busy}
                  />
                </div>
                <label>
                  {text('Stock condition')}
                  <select
                    value={line.condition}
                    onChange={(event) =>
                      updateLine(line.key, { condition: event.target.value as StockCondition })
                    }
                  >
                    <option value="available">{text('Available')}</option>
                    <option value="non_sellable">{text('Non-Sellable')}</option>
                  </select>
                </label>
                <label>
                  {text('Quantity')}
                  <Input
                    required
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                  />
                </label>
                <label>
                  {text('Unit')}
                  <select
                    required
                    value={line.unitCode}
                    onChange={(event) => updateLine(line.key, { unitCode: event.target.value })}
                  >
                    {stockUnitOptions(item).map((option) => (
                      <option key={option.code} value={option.code}>
                        {formatDigits(`${option.name} (${option.code})`)}
                      </option>
                    ))}
                  </select>
                </label>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((candidate) => candidate.key !== line.key),
                      )
                    }
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
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              {text('Add line')}
            </Button>
          </div>
        </fieldset>
        {(formError || error) && (
          <p className="inventory-error" role="alert">
            {formError || error}
          </p>
        )}
        <p className="inventory-note">
          {text('This invoice is a draft. Saving it does not affect stock.')}
        </p>
        <footer className="products-dialog-footer">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {text('Close')}
          </Button>
          {step === 2 && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(1)}>
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
                if (!supplierId || !warehouseId) {
                  setFormError(text('Choose a supplier and warehouse to continue.'));
                  return;
                }
                setFormError('');
                setStep(2);
              }}
            >
              {text('Continue to items')}
            </Button>
          ) : (
            <Button key="save-draft" type="submit" disabled={busy}>
              {text(busy ? 'Saving…' : 'Save draft')}
            </Button>
          )}
        </footer>
      </form>
    </DashboardDialog>
  );
}
