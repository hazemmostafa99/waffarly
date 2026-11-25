import { useRef, useState, type FormEvent } from 'react';
import type {
  InventoryWarehouseSummary,
  RecordStockWasteRequest,
  StockCondition,
  StockItem,
  StockMovementBatchResult,
  TransferStockRequest,
} from '@waffarly/contracts';
import { Button, Input, useLocale } from '@waffarly/ui';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { apiRequest } from '../../lib/api-client.js';
import { InventoryHeader } from './InventoryHeader.js';
import { InventoryCard } from './InventoryCard.js';
import { inventoryCopy, useInventoryText } from './inventory-copy.js';
import { StockItemPicker, WarehousePicker } from './components/InventoryPickers.js';
import { cacheStockItem, stockUnitOptions } from './stock-unit-options.js';

type DraftLine = {
  key: string;
  stockItemId: string;
  condition: StockCondition;
  quantity: string;
  unitCode: string;
};

const emptyLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  stockItemId: '',
  condition: 'available',
  quantity: '1',
  unitCode: '',
});

export function InventoryStockActionPage({ action }: { action: 'waste' | 'transfer' }) {
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = useInventoryText();
  const navigate = useNavigate();
  const [items, setItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseSummary[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [postStarted, setPostStarted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<RecordStockWasteRequest | TransferStockRequest | null>(
    null,
  );
  const requestId = useRef(crypto.randomUUID());
  const isWaste = action === 'waste';

  function updateLine(key: string, change: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!reason.trim() || (!isWaste && (!warehouseId || !destinationId))) {
      setError(text('Complete the required fields before review.'));
      return;
    }
    if (!isWaste && warehouseId === destinationId) {
      setError(text('Choose different source and destination warehouses.'));
      return;
    }
    if (lines.some((line) => !line.stockItemId || !line.quantity || !line.unitCode)) {
      setError(text('Choose a stock item, unit, and quantity for each line.'));
      return;
    }
    const lineKeys = lines.map((line) => `${line.stockItemId}:${line.condition}`);
    if (new Set(lineKeys).size !== lineKeys.length) {
      setError(text('Each stock item and condition can appear only once.'));
      return;
    }
    if (isWaste) {
      const body: RecordStockWasteRequest = {
        requestId: requestId.current,
        reason: reason.trim(),
        lines: lines.map(({ stockItemId, condition, quantity, unitCode }) => ({
          warehouseId,
          stockItemId,
          condition,
          quantity: quantity.trim(),
          unitCode,
        })),
      };
      setPending(body);
    } else {
      const body: TransferStockRequest = {
        requestId: requestId.current,
        reason: reason.trim(),
        sourceWarehouseId: warehouseId,
        destinationWarehouseId: destinationId,
        lines: lines.map(({ stockItemId, condition, quantity, unitCode }) => ({
          stockItemId,
          condition,
          quantity: quantity.trim(),
          unitCode,
        })),
      };
      setPending(body);
    }
    setReviewing(true);
  }

  function backToEdit() {
    if (busy || postStarted) return;
    setReviewing(false);
    setPending(null);
  }

  async function post() {
    if (!pending || busy) return;
    setBusy(true);
    setPostStarted(true);
    setError('');
    try {
      const result = await apiRequest<StockMovementBatchResult>(
        `/owner/inventory/${isWaste ? 'waste' : 'transfers'}`,
        { method: 'POST', body: JSON.stringify(pending) },
      );
      setNotice(
        result.replayed
          ? text('This movement was already recorded; no duplicate stock was changed.')
          : text(isWaste ? 'Waste recorded.' : 'Stock transfer recorded.'),
      );
      setReviewing(false);
      setPending(null);
      setPostStarted(false);
      setReason('');
      setLines([emptyLine()]);
      setWarehouseId('');
      setDestinationId('');
      requestId.current = crypto.randomUUID();
    } catch (cause) {
      setError(
        cause instanceof Error ? errorText(cause.message) : text('Could not record this movement.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedSource = warehouses.find((warehouse) => warehouse.id === warehouseId);
  const selectedDestination = warehouses.find((warehouse) => warehouse.id === destinationId);

  return (
    <main className="inventory-page inventory-workspace" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title={isWaste ? 'Record stock waste' : 'Transfer stock'}
        description={
          isWaste
            ? 'Record damaged, expired, or otherwise lost stock with its current cost snapshot.'
            : 'Move quantities between warehouses without changing the stock item cost.'
        }
        actions={
          <Button type="button" variant="outline" onClick={() => navigate('/inventory/history')}>
            {text('Movement history')}
          </Button>
        }
      />
      {notice && (
        <p className="inventory-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="inventory-error" role="alert">
          {error}
        </p>
      )}
      <InventoryCard
        className="inventory-operation-card"
        title={text(isWaste ? 'Waste details' : 'Transfer details')}
        description={text(
          isWaste
            ? 'Choose the warehouse and the quantities to write off.'
            : 'Choose both warehouses and the quantities to move.',
        )}
      >
        <ol className="inventory-flow-steps" aria-label={text('Stock operations')}>
          <li>{text('Choose warehouse')}</li>
          <li>{text('Add items and quantities')}</li>
          <li>{text('Review before posting')}</li>
        </ol>
        <form className="inventory-editor" onSubmit={review}>
          <div className="inventory-location-fields">
            <label>
              {text(isWaste ? 'Warehouse' : 'Source warehouse')}
              <WarehousePicker
                value={warehouseId}
                label={text(isWaste ? 'Warehouse' : 'Source warehouse')}
                onResolve={(warehouse) =>
                  setWarehouses((current) => [
                    ...current.filter((entry) => entry.id !== warehouse.id),
                    warehouse,
                  ])
                }
                onSelect={(warehouse) => {
                  if (warehouse)
                    setWarehouses((current) => [
                      ...current.filter((entry) => entry.id !== warehouse.id),
                      warehouse,
                    ]);
                  setWarehouseId(warehouse?.id ?? '');
                }}
              />
            </label>
            {!isWaste && (
              <label>
                {text('Destination warehouse')}
                <WarehousePicker
                  value={destinationId}
                  label={text('Destination warehouse')}
                  onResolve={(warehouse) =>
                    setWarehouses((current) => [
                      ...current.filter((entry) => entry.id !== warehouse.id),
                      warehouse,
                    ])
                  }
                  onSelect={(warehouse) => {
                    if (warehouse)
                      setWarehouses((current) => [
                        ...current.filter((entry) => entry.id !== warehouse.id),
                        warehouse,
                      ]);
                    setDestinationId(warehouse?.id ?? '');
                  }}
                />
              </label>
            )}
          </div>
          <label>
            {text('Reason')}
            <Input
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={text(isWaste ? 'Expired or damaged stock' : 'Restock another warehouse')}
            />
          </label>
          <h3>{text('Stock items and quantities')}</h3>
          {lines.map((line, index) => {
            const item = items.find((entry) => entry.id === line.stockItemId);
            return (
              <fieldset className="inventory-opening-line" key={line.key}>
                <legend>
                  {text('Line')} {formatDigits(String(index + 1))}
                </legend>
                <label>
                  {text('Stock item')}
                  <StockItemPicker
                    value={line.stockItemId}
                    label={text('Stock item')}
                    onResolve={(stockItem) =>
                      setItems((current) => cacheStockItem(current, stockItem))
                    }
                    onSelect={(stockItem) => {
                      if (stockItem) setItems((current) => cacheStockItem(current, stockItem));
                      updateLine(line.key, {
                        stockItemId: stockItem?.id ?? '',
                        unitCode: stockItem?.baseUnit ?? '',
                      });
                    }}
                  />
                </label>
                <label>
                  {text('Condition')}
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
                    {stockUnitOptions(item).map((unit) => (
                      <option key={unit.code} value={unit.code}>
                        {formatDigits(`${unit.name} (${unit.code})`)}
                      </option>
                    ))}
                  </select>
                </label>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setLines((current) => current.filter((entry) => entry.key !== line.key))
                    }
                  >
                    {text('Remove line')}
                  </Button>
                )}
              </fieldset>
            );
          })}
          <div className="inventory-editor-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              {text('Add line')}
            </Button>
            <Button type="submit">{text('Review movement')}</Button>
          </div>
        </form>
      </InventoryCard>
      {reviewing && pending && (
        <DashboardDialog
          title={text(isWaste ? 'Review stock waste' : 'Review stock transfer')}
          closeLabel={text('Close')}
          onClose={() => backToEdit()}
          busy={busy}
        >
          <div className="products-dialog-body inventory-review">
            <p>
              {text(
                isWaste
                  ? 'Posting reduces the selected stock and saves the active item cost for this movement.'
                  : 'Posting reduces the source and adds the same quantities to the destination in one transaction. It does not change the item cost.',
              )}
            </p>
            <p>
              <strong>{text('Reason')}:</strong> {formatDigits(pending.reason)}
            </p>
            {!isWaste && (
              <p>
                {formatDigits(
                  `${selectedSource?.branchName ?? ''} · ${selectedSource?.name ?? ''} → ${selectedDestination?.branchName ?? ''} · ${selectedDestination?.name ?? ''}`,
                )}
              </p>
            )}
            <ul>
              {pending.lines.map((line, index) => {
                const item = items.find((entry) => entry.id === line.stockItemId);
                return (
                  <li key={`${line.stockItemId}:${index}`}>
                    <strong>{formatDigits(item?.name ?? '')}</strong>
                    <span>
                      {formatDigits(
                        `${line.quantity} ${line.unitCode} · ${line.condition === 'available' ? text('Available') : text('Non-Sellable')}`,
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {error && (
              <p className="inventory-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="products-dialog-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy || postStarted}
              onClick={backToEdit}
            >
              {text('Back to edit')}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void post()}>
              {busy ? text('Posting…') : text('Post movement')}
            </Button>
          </footer>
        </DashboardDialog>
      )}
      <Link className="inventory-detail-link" to="/inventory/history">
        {text('View movement history')}
      </Link>
    </main>
  );
}
