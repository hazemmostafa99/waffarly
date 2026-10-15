import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DashboardCard,
  DataTable,
  Input,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import {
  STOCK_BASE_UNITS,
  type StockBaseUnit,
  type StockItem,
  type StockItemConversion,
  type StockItemUnitFields,
} from '@waffarly/contracts';
import { DashboardDialog } from './components/DashboardDialog.js';
import { apiRequestPage, apiRequest } from './lib/api-client.js';
import { inventoryCopy } from './inventory-copy.js';

type EditorState = { item: StockItem | null; key: string };
type PackDraft = { code: string; name: string; baseQuantity: string };
const emptyPack = (): PackDraft => ({ code: '', name: '', baseQuantity: '' });
const baseLabels: Record<StockBaseUnit, string> = {
  piece: 'Piece',
  g: 'Gram (g)',
  kg: 'Kilogram (kg)',
  ml: 'Millilitre (ml)',
  l: 'Litre (l)',
};

export function StockItemsPage() {
  const { locale, t, errorText, formatDigits } = useLocale();
  const navigate = useNavigate();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const [items, setItems] = useState<StockItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirming, setConfirming] = useState<StockItem | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    const query = new URLSearchParams({ limit: '25', status });
    if (search) query.set('search', search);
    const cursor = history.at(-1);
    if (cursor) query.set('cursor', cursor);
    void apiRequestPage<StockItem>(`/owner/inventory/items?${query.toString()}`)
      .then((page) => {
        if (!current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (current)
          setLoadError(
            cause instanceof Error ? cause.message : text('Could not load stock items.'),
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [history, refreshKey, search, status]);

  const columns: DataTableColumn<StockItem>[] = [
    {
      id: 'name',
      header: text('Stock item'),
      cell: (item) => (
        <div className="inventory-table-name">
          <strong>{formatDigits(item.name)}</strong>
          {item.description && <small>{formatDigits(item.description)}</small>}
        </div>
      ),
    },
    { id: 'baseUnit', header: text('Base unit'), cell: (item) => text(baseLabels[item.baseUnit]) },
    {
      id: 'units',
      header: text('Pack units'),
      cell: (item) =>
        item.units.length ? (
          <div className="inventory-unit-list">
            {item.units.map((unit) => (
              <span key={unit.id} title={`1 ${unit.code} = ${unit.baseQuantity} ${item.baseUnit}`}>
                {formatDigits(unit.name)}{' '}
                <small>
                  {formatDigits(`1 ${unit.code} = ${unit.baseQuantity} ${item.baseUnit}`)}
                </small>
              </span>
            ))}
          </div>
        ) : (
          <span className="inventory-muted">{text('Standard units only')}</span>
        ),
    },
    {
      id: 'action',
      header: text('Action'),
      className: 'inventory-action-cell',
      cell: (item) => (
        <div className="inventory-row-actions">
          {item.archivedAt ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(item)}>
              {text('Restore')}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditor({ item, key: item.id })}
              >
                {text('Edit')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(item)}>
                {text('Archive')}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setHistory([]);
    setNextCursor(null);
  }

  async function changeArchiveState() {
    if (!confirming) return;
    const item = confirming;
    const action = item.archivedAt ? 'restore' : 'archive';
    try {
      await apiRequest<StockItem>(`/owner/inventory/items/${item.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ revision: item.revision }),
      });
      setConfirming(null);
      setNotice(item.archivedAt ? text('Stock item restored.') : text('Stock item archived.'));
      setHistory([]);
      setRefreshKey((key) => key + 1);
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? errorText(cause.message)
          : text('Could not update the stock item.'),
      );
      setConfirming(null);
    }
  }

  function editorSaved(created: boolean) {
    setEditor(null);
    setNotice(
      created ? text('Stock item created. No stock was added.') : text('Stock item saved.'),
    );
    setHistory([]);
    setRefreshKey((key) => key + 1);
    if (status === 'archived') setStatus('active');
  }

  return (
    <main className="inventory-page">
      <section className="inventory-intro">
        <div>
          <span className="inventory-eyebrow">{text('Inventory foundation')}</span>
          <h2>{text('Shared stock identities')}</h2>
          <p>
            {text(
              'Set the ingredient and product units that recipes and stock movements will share.',
            )}
          </p>
        </div>
        <div className="inventory-intro-actions">
          <Button type="button" variant="outline" onClick={() => navigate('/inventory/purchases')}>
            {text('Purchase invoices')}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/inventory/operations')}>
            {text('Balances and movements')}
          </Button>
          <Button type="button" onClick={() => setEditor({ item: null, key: crypto.randomUUID() })}>
            {text('New stock item')}
          </Button>
        </div>
      </section>

      {notice && (
        <p className="inventory-notice" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <div className="inventory-error" role="alert">
          <span>{errorText(loadError)}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            {text('Retry')}
          </Button>
        </div>
      )}

      <DashboardCard
        title={text('Stock item library')}
        description={text(
          'One item can be shared by products and recipes. Pack conversion factors stay fixed after saving.',
        )}
      >
        <div className="inventory-filters">
          <form className="inventory-search" onSubmit={applySearch}>
            <label htmlFor="inventory-search">{text('Search stock items')}</label>
            <div>
              <Input
                id="inventory-search"
                value={searchDraft}
                maxLength={160}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={text('Search by item name')}
              />
              <Button type="submit" variant="outline">
                {text('Search')}
              </Button>
            </div>
          </form>
          <label className="inventory-filter-status">
            {text('Status')}
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setHistory([]);
              }}
            >
              <option value="active">{text('Active')}</option>
              <option value="archived">{text('Archived')}</option>
              <option value="all">{text('All items')}</option>
            </select>
          </label>
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(item) => item.id}
          caption={text('Stock item library')}
          loading={loading}
          loadingState={text('Loading stock items…')}
          emptyState={text('No stock items here yet. Add a stock item to begin.')}
        />
        <div className="inventory-pagination">
          <span>
            {formatDigits(`${items.length} ${items.length === 1 ? 'item' : 'items'} on this page`)}
          </span>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || history.length === 0}
              onClick={() => setHistory((page) => page.slice(0, -1))}
            >
              {text('Previous')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || !nextCursor}
              onClick={() => setHistory((page) => [...page, nextCursor ?? undefined])}
            >
              {text('Next')}
            </Button>
          </div>
        </div>
      </DashboardCard>

      {editor && (
        <StockItemEditor
          key={editor.key}
          requestId={editor.key}
          item={editor.item}
          copy={text}
          onClose={() => setEditor(null)}
          onSaved={editorSaved}
        />
      )}
      {confirming && (
        <DashboardDialog
          title={confirming.archivedAt ? text('Restore stock item?') : text('Archive stock item?')}
          closeLabel={text('Close')}
          onClose={() => setConfirming(null)}
        >
          <div className="products-dialog-body">
            <p>
              {confirming.archivedAt
                ? text('This item will become available for future configuration.')
                : text(
                    'The item will be hidden from new configurations. Existing references will remain intact.',
                  )}
            </p>
            <p>
              <strong>{formatDigits(confirming.name)}</strong>
            </p>
          </div>
          <footer className="products-dialog-footer">
            <Button type="button" variant="outline" onClick={() => setConfirming(null)}>
              {text('Cancel')}
            </Button>
            <Button type="button" onClick={() => void changeArchiveState()}>
              {confirming.archivedAt ? text('Restore') : text('Archive')}
            </Button>
          </footer>
        </DashboardDialog>
      )}
    </main>
  );
}

function StockItemEditor({
  requestId,
  item,
  copy,
  onClose,
  onSaved,
}: {
  requestId: string;
  item: StockItem | null;
  copy: (value: string) => string;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const { errorText, formatDigits } = useLocale();
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [baseUnit, setBaseUnit] = useState<StockBaseUnit>(item?.baseUnit ?? 'piece');
  const [units, setUnits] = useState<StockItemUnitFields[]>(
    item?.units.map(({ code, name, baseQuantity }) => ({ code, name, baseQuantity })) ?? [],
  );
  const [newUnit, setNewUnit] = useState<PackDraft>(emptyPack);
  const [quantity, setQuantity] = useState('1');
  const [unitCode, setUnitCode] = useState(item?.units[0]?.code ?? item?.baseUnit ?? 'piece');
  const [conversion, setConversion] = useState<StockItemConversion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const text = copy;
  const created = item === null;

  function addUnit() {
    const pack = {
      code: newUnit.code.trim().toLowerCase(),
      name: newUnit.name.trim(),
      baseQuantity: newUnit.baseQuantity.trim(),
    };
    if (
      !/^[a-z][a-z0-9_-]{0,31}$/.test(pack.code) ||
      (STOCK_BASE_UNITS as readonly string[]).includes(pack.code) ||
      !pack.name ||
      !/^(0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(pack.baseQuantity) ||
      /^0(?:\.0+)?$/.test(pack.baseQuantity) ||
      units.some((unit) => unit.code === pack.code) ||
      units.length >= 20
    ) {
      setError(text('Check the pack code, name, positive conversion, and 20-unit limit.'));
      return;
    }
    setUnits((previous) => [...previous, pack]);
    if (created) setUnitCode(pack.code);
    setNewUnit(emptyPack());
    setConversion(null);
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const additionalUnits = units.filter(
        (unit) => !item?.units.some((existing) => existing.code === unit.code),
      );
      if (created) {
        await apiRequest<StockItem>('/owner/inventory/items', {
          method: 'POST',
          body: JSON.stringify({ requestId, name: name.trim(), description, baseUnit, units }),
        });
      } else {
        await apiRequest<StockItem>(`/owner/inventory/items/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            description,
            revision: item.revision,
            additionalUnits,
          }),
        });
      }
      onSaved(created);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : text('Could not save the stock item.');
      setError(errorText(message));
    } finally {
      setBusy(false);
    }
  }

  async function previewConversion() {
    if (!item) return;
    setBusy(true);
    setError('');
    setConversion(null);
    try {
      setConversion(
        await apiRequest<StockItemConversion>(`/owner/inventory/items/${item.id}/convert`, {
          method: 'POST',
          body: JSON.stringify({ quantity, unitCode }),
        }),
      );
    } catch (cause) {
      setError(
        errorText(
          cause instanceof Error ? cause.message : text('Could not convert this quantity.'),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardDialog
      title={created ? text('Create stock item') : text('Edit stock item')}
      closeLabel={text('Close')}
      onClose={onClose}
      busy={busy}
    >
      <form
        className="products-dialog-body inventory-editor"
        onSubmit={(event) => void save(event)}
      >
        {error && (
          <p className="inventory-error" role="alert">
            {error}
          </p>
        )}
        <label>
          {text('Item name')}
          <Input
            autoFocus
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label>
          {text('Description')}
          <textarea
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          {text('Base unit')}
          <select
            value={baseUnit}
            disabled={!created}
            onChange={(event) => setBaseUnit(event.target.value as StockBaseUnit)}
          >
            {STOCK_BASE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {text(baseLabels[unit])}
              </option>
            ))}
          </select>
          {!created && <small>{text('The base unit cannot change after creation.')}</small>}
        </label>
        <div className="inventory-pack-heading">
          <div>
            <h3>{text('Pack units')}</h3>
            <p>{text('Optional. For example, one case contains 12 pieces.')}</p>
          </div>
          <span>{formatUnitCount(units.length, text)}</span>
        </div>
        {!!units.length && (
          <ul className="inventory-saved-units">
            {units.map((unit) => (
              <li key={unit.code}>
                <strong>{text(unit.name)}</strong>
                <code>{formatUnitEquation(unit, baseUnit)}</code>
                <small>{text('Conversion is fixed.')}</small>
              </li>
            ))}
          </ul>
        )}
        {units.length < 20 && (
          <div className="inventory-pack-form">
            <label>
              {text('Pack code')}
              <Input
                disabled={busy}
                value={newUnit.code}
                maxLength={32}
                placeholder={text('case')}
                onChange={(event) =>
                  setNewUnit((previous) => ({ ...previous, code: event.target.value }))
                }
              />
            </label>
            <label>
              {text('Pack name')}
              <Input
                disabled={busy}
                value={newUnit.name}
                maxLength={80}
                placeholder={text('Case')}
                onChange={(event) =>
                  setNewUnit((previous) => ({ ...previous, name: event.target.value }))
                }
              />
            </label>
            <label>
              {text('Base quantity per pack')}
              <Input
                disabled={busy}
                value={newUnit.baseQuantity}
                maxLength={19}
                inputMode="decimal"
                placeholder="12"
                onChange={(event) =>
                  setNewUnit((previous) => ({ ...previous, baseQuantity: event.target.value }))
                }
              />
            </label>
            <Button type="button" variant="outline" disabled={busy} onClick={addUnit}>
              {text('Add unit')}
            </Button>
          </div>
        )}
        {units.length === 20 && (
          <p className="inventory-muted">{text('Maximum 20 pack units reached.')}</p>
        )}
        {created && (
          <p className="inventory-note">
            {text(
              'Saving this item creates its identity and units only. It will not add opening stock.',
            )}
          </p>
        )}
        {item && (
          <section className="inventory-converter">
            <h3>{text('Conversion preview')}</h3>
            <div>
              <label>
                {text('Quantity')}
                <Input
                  value={quantity}
                  maxLength={19}
                  inputMode="decimal"
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    setConversion(null);
                  }}
                />
              </label>
              <label>
                {text('Unit')}
                <select
                  value={unitCode}
                  onChange={(event) => {
                    setUnitCode(event.target.value);
                    setConversion(null);
                  }}
                >
                  {[
                    ...compatibleBaseUnits(item.baseUnit),
                    ...item.units.map((unit) => unit.code),
                  ].map((unit) => (
                    <option key={unit} value={unit}>
                      {text(
                        item.units.find((pack) => pack.code === unit)?.name ??
                          baseLabels[unit as StockBaseUnit],
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void previewConversion()}
              >
                {text('Convert')}
              </Button>
            </div>
            {conversion && (
              <p role="status">
                <strong>{formatDigits(`${conversion.quantity} ${conversion.unitCode}`)}</strong> ={' '}
                <strong>{formatDigits(`${conversion.baseQuantity} ${conversion.baseUnit}`)}</strong>
              </p>
            )}
          </section>
        )}
        <footer className="products-dialog-footer">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {text('Cancel')}
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? text('Saving…') : created ? text('Create stock item') : text('Save changes')}
          </Button>
        </footer>
      </form>
    </DashboardDialog>
  );
}

function formatUnitCount(count: number, text: (value: string) => string) {
  return `${count}/20 ${text('pack units')}`;
}
function formatUnitEquation(unit: StockItemUnitFields, baseUnit: StockBaseUnit) {
  return `1 ${unit.code} = ${unit.baseQuantity} ${baseUnit}`;
}
function compatibleBaseUnits(baseUnit: StockBaseUnit): StockBaseUnit[] {
  if (baseUnit === 'piece') return ['piece'];
  if (baseUnit === 'g' || baseUnit === 'kg') return ['g', 'kg'];
  return ['ml', 'l'];
}
