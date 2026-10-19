import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  DashboardCard,
  DataTable,
  Input,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import type { InventoryBranch, InventoryWarehouse } from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { apiRequest, apiRequestPage } from '../../lib/api-client.js';
import { inventoryCopy } from './inventory-copy.js';
import { InventoryHeader } from './InventoryHeader.js';

type BranchEditorState = { branch: InventoryBranch | null; key: string };
type WarehouseEditorState = {
  warehouse: InventoryWarehouse | null;
  branch: InventoryBranch;
  key: string;
};
type ArchiveTarget =
  { branch: InventoryBranch } | { branch: InventoryBranch; warehouse: InventoryWarehouse };

export function BranchesPage() {
  const { locale, t, errorText, formatDigits } = useLocale();
  const text = (value: string) => inventoryCopy(value, locale, t);
  const [branches, setBranches] = useState<InventoryBranch[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [branchEditor, setBranchEditor] = useState<BranchEditorState | null>(null);
  const [warehouseEditor, setWarehouseEditor] = useState<WarehouseEditorState | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setListError('');
    const query = new URLSearchParams({ limit: '50', status });
    if (search) query.set('search', search);
    const cursor = history.at(-1);
    if (cursor) query.set('cursor', cursor);
    void apiRequestPage<InventoryBranch>(`/owner/inventory/branches?${query.toString()}`)
      .then((page) => {
        if (!current) return;
        setBranches(page.items);
        setNextCursor(page.nextCursor);
        setSelectedId((selected) =>
          page.items.some((branch) => branch.id === selected)
            ? selected
            : (page.items[0]?.id ?? ''),
        );
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setListError(
          cause instanceof Error ? errorText(cause.message) : text('Could not load branches.'),
        );
        setBranches([]);
        setNextCursor(null);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [errorText, history, refreshKey, search, status]);

  const selected = branches.find((branch) => branch.id === selectedId) ?? null;
  const columns: DataTableColumn<InventoryBranch>[] = [
    {
      id: 'branch',
      header: text('Branch'),
      cell: (branch) => (
        <div className="inventory-table-name">
          <strong>{formatDigits(branch.name)}</strong>
          {branch.address && <small>{formatDigits(branch.address)}</small>}
        </div>
      ),
    },
    {
      id: 'warehouses',
      header: text('Warehouses'),
      cell: (branch) => (
        <div className="inventory-table-name">
          <strong>
            {formatDigits(
              String(branch.warehouses.filter((warehouse) => !warehouse.archivedAt).length),
            )}
          </strong>
          <small>
            {formatDigits(
              branch.warehouses.find((warehouse) => warehouse.isDefaultConsumption)?.name ??
                text('No default warehouse'),
            )}
          </small>
        </div>
      ),
    },
    {
      id: 'status',
      header: text('Status'),
      cell: (branch) => text(branch.archivedAt ? 'Archived' : 'Active'),
    },
    {
      id: 'actions',
      header: text('Actions'),
      className: 'inventory-action-cell',
      cell: (branch) => (
        <div className="inventory-row-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedId(branch.id)}
          >
            {text('Manage')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={Boolean(branch.archivedAt)}
            onClick={() => setBranchEditor({ branch, key: branch.id })}
          >
            {text('Edit')}
          </Button>
        </div>
      ),
    },
  ];

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setHistory([]);
  }

  function changed(branch: InventoryBranch, message: string) {
    setSelectedId(branch.id);
    setNotice(text(message));
    setLoadError('');
    setHistory([]);
    setRefreshKey((key) => key + 1);
  }

  async function saveWarehouseDefault(branch: InventoryBranch, warehouse: InventoryWarehouse) {
    setBusy(true);
    setLoadError('');
    try {
      const updated = await apiRequest<InventoryBranch>(
        `/owner/inventory/branches/${branch.id}/default-consumption-warehouse`,
        {
          method: 'PATCH',
          body: JSON.stringify({ revision: branch.revision, warehouseId: warehouse.id }),
        },
      );
      changed(updated, 'Default warehouse updated.');
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? errorText(cause.message) : text('Could not update the warehouse.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeArchiveState() {
    if (!archiveTarget) return;
    setBusy(true);
    setLoadError('');
    const branch = archiveTarget.branch;
    const warehouse = 'warehouse' in archiveTarget ? archiveTarget.warehouse : null;
    const archived = warehouse?.archivedAt ?? branch.archivedAt;
    const action = archived ? 'restore' : 'archive';
    const path = warehouse
      ? `/owner/inventory/branches/${branch.id}/warehouses/${warehouse.id}/${action}`
      : `/owner/inventory/branches/${branch.id}/${action}`;
    const revision = warehouse?.revision ?? branch.revision;
    try {
      const updated = await apiRequest<InventoryBranch>(path, {
        method: 'POST',
        body: JSON.stringify({ revision }),
      });
      setArchiveTarget(null);
      changed(updated, archived ? 'Location restored.' : 'Location archived.');
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? errorText(cause.message) : text('Could not update this location.'),
      );
      setArchiveTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title="Branches and warehouses"
        description="Each branch can hold multiple warehouses and has one default consumption warehouse."
        showInventoryNavigation={false}
        actions={
          <Button
            type="button"
            onClick={() => setBranchEditor({ branch: null, key: crypto.randomUUID() })}
          >
            {text('Add branch')}
          </Button>
        }
      />

      {notice && (
        <p className="inventory-notice" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <div className="inventory-error" role="alert">
          {loadError}
          <Button type="button" variant="ghost" size="sm" onClick={() => setLoadError('')}>
            {text('Close')}
          </Button>
        </div>
      )}

      <DashboardCard
        title={text('Branch directory')}
        description={text('Manage branch addresses and stock warehouses.')}
      >
        {listError && (
          <div className="inventory-error" role="alert">
            <span>{listError}</span>
            <span className="inventory-error-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setListError('');
                  setRefreshKey((key) => key + 1);
                }}
              >
                {text('Retry')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setListError('')}>
                {text('Close')}
              </Button>
            </span>
          </div>
        )}
        <div className="inventory-filters">
          <form className="inventory-search" onSubmit={applySearch}>
            <label htmlFor="branch-search">{text('Search branches')}</label>
            <div>
              <Input
                id="branch-search"
                value={searchDraft}
                maxLength={160}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={text('Search by branch name')}
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
              <option value="all">{text('All locations')}</option>
            </select>
          </label>
        </div>
        <DataTable
          columns={columns}
          rows={branches}
          rowKey={(branch) => branch.id}
          caption={text('Branch directory')}
          loading={loading}
          loadingState={text('Loading branches…')}
          emptyState={
            listError ? (
              <div className="inventory-empty">
                <h3>{text('Could not load branches.')}</h3>
                <p>{text('Retry loading the list to see your branches and warehouses.')}</p>
              </div>
            ) : (
              text('No branches yet. Add a branch to begin.')
            )
          }
        />
        <div className="inventory-pagination">
          <span>{formatDigits(`${branches.length} ${text('branches on this page')}`)}</span>
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

      {selected && (
        <DashboardCard
          title={formatDigits(selected.name)}
          description={
            selected.address ? formatDigits(selected.address) : text('No address provided.')
          }
        >
          <div className="inventory-pack-heading">
            <div>
              <h3>{text('Warehouses')}</h3>
              <p>{text('The default warehouse is used for future recipe consumption.')}</p>
            </div>
            <div className="inventory-row-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(selected.archivedAt)}
                onClick={() => setBranchEditor({ branch: selected, key: selected.id })}
              >
                {text('Edit branch')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setArchiveTarget({ branch: selected })}
              >
                {selected.archivedAt ? text('Restore branch') : text('Archive branch')}
              </Button>
              {!selected.archivedAt && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setWarehouseEditor({
                      warehouse: null,
                      branch: selected,
                      key: crypto.randomUUID(),
                    })
                  }
                >
                  {text('Add warehouse')}
                </Button>
              )}
            </div>
          </div>
          <ul className="inventory-saved-units">
            {selected.warehouses.map((warehouse) => (
              <li key={warehouse.id}>
                <span>
                  <strong>{formatDigits(warehouse.name)}</strong>
                  {warehouse.isDefaultConsumption && (
                    <small> · {text('Default consumption warehouse')}</small>
                  )}
                  {warehouse.archivedAt && <small> · {text('Archived')}</small>}
                </span>
                <div className="inventory-row-actions">
                  {!warehouse.archivedAt && !warehouse.isDefaultConsumption && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || Boolean(selected.archivedAt)}
                      onClick={() => void saveWarehouseDefault(selected, warehouse)}
                    >
                      {text('Set as default')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || Boolean(selected.archivedAt)}
                    onClick={() =>
                      setWarehouseEditor({ warehouse, branch: selected, key: warehouse.id })
                    }
                  >
                    {text('Edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy || Boolean(selected.archivedAt)}
                    onClick={() => setArchiveTarget({ branch: selected, warehouse })}
                  >
                    {warehouse.archivedAt ? text('Restore') : text('Archive')}
                  </Button>
                </div>
              </li>
            ))}
            {selected.warehouses.length === 0 && <li>{text('No warehouses yet.')}</li>}
          </ul>
        </DashboardCard>
      )}

      {branchEditor && (
        <BranchEditor
          key={branchEditor.key}
          branch={branchEditor.branch}
          copy={text}
          onClose={() => setBranchEditor(null)}
          onSaved={(branch, message) => {
            setBranchEditor(null);
            changed(branch, message);
          }}
        />
      )}
      {warehouseEditor && (
        <WarehouseEditor
          key={warehouseEditor.key}
          branch={warehouseEditor.branch}
          warehouse={warehouseEditor.warehouse}
          copy={text}
          onClose={() => setWarehouseEditor(null)}
          onSaved={(branch) => {
            setWarehouseEditor(null);
            changed(branch, 'Warehouse saved.');
          }}
        />
      )}
      {archiveTarget && (
        <DashboardDialog
          title={text('Confirm location change')}
          closeLabel={text('Close')}
          onClose={() => !busy && setArchiveTarget(null)}
          busy={busy}
        >
          <div className="products-dialog-body">
            <p>
              {text(
                'Archiving requires all balances in this location to be zero. The default warehouse must be changed first.',
              )}
            </p>
          </div>
          <footer className="products-dialog-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setArchiveTarget(null)}
            >
              {text('Cancel')}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void changeArchiveState()}>
              {text('Confirm')}
            </Button>
          </footer>
        </DashboardDialog>
      )}
    </main>
  );
}

function BranchEditor({
  branch,
  copy,
  onClose,
  onSaved,
}: {
  branch: InventoryBranch | null;
  copy: (value: string) => string;
  onClose: () => void;
  onSaved: (branch: InventoryBranch, message: string) => void;
}) {
  const { errorText } = useLocale();
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? '');
  const [defaultWarehouseName, setDefaultWarehouseName] = useState('Main warehouse');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = branch
        ? await apiRequest<InventoryBranch>(`/owner/inventory/branches/${branch.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              revision: branch.revision,
              name: name.trim(),
              address: address.trim(),
            }),
          })
        : await apiRequest<InventoryBranch>('/owner/inventory/branches', {
            method: 'POST',
            body: JSON.stringify({
              name: name.trim(),
              address: address.trim(),
              defaultWarehouseName: defaultWarehouseName.trim(),
            }),
          });
      onSaved(updated, branch ? 'Branch saved.' : 'Branch created.');
    } catch (cause) {
      setError(
        errorText(cause instanceof Error ? cause.message : copy('Could not save this location.')),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardDialog
      title={copy(branch ? 'Edit branch' : 'Add branch')}
      closeLabel={copy('Close')}
      onClose={() => !busy && onClose()}
      busy={busy}
    >
      <form
        className="inventory-editor products-dialog-body"
        onSubmit={(event) => void save(event)}
      >
        {error && (
          <div className="inventory-error" role="alert">
            {error}
          </div>
        )}
        <label>
          {copy('Branch name')}
          <Input
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          {copy('Address')}
          <Input
            maxLength={500}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>
        {!branch && (
          <label>
            {copy('Default warehouse name')}
            <Input
              required
              maxLength={160}
              value={defaultWarehouseName}
              onChange={(event) => setDefaultWarehouseName(event.target.value)}
            />
          </label>
        )}
        <footer className="products-dialog-footer">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {copy('Cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? copy('Saving…') : copy(branch ? 'Save changes' : 'Create branch')}
          </Button>
        </footer>
      </form>
    </DashboardDialog>
  );
}

function WarehouseEditor({
  branch,
  warehouse,
  copy,
  onClose,
  onSaved,
}: {
  branch: InventoryBranch;
  warehouse: InventoryWarehouse | null;
  copy: (value: string) => string;
  onClose: () => void;
  onSaved: (branch: InventoryBranch) => void;
}) {
  const { errorText } = useLocale();
  const [name, setName] = useState(warehouse?.name ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = warehouse
        ? await apiRequest<InventoryBranch>(
            `/owner/inventory/branches/${branch.id}/warehouses/${warehouse.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ revision: warehouse.revision, name: name.trim() }),
            },
          )
        : await apiRequest<InventoryBranch>(`/owner/inventory/branches/${branch.id}/warehouses`, {
            method: 'POST',
            body: JSON.stringify({ revision: branch.revision, name: name.trim() }),
          });
      onSaved(updated);
    } catch (cause) {
      setError(
        errorText(cause instanceof Error ? cause.message : copy('Could not save this location.')),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardDialog
      title={copy(warehouse ? 'Edit warehouse' : 'Add warehouse')}
      closeLabel={copy('Close')}
      onClose={() => !busy && onClose()}
      busy={busy}
    >
      <form
        className="inventory-editor products-dialog-body"
        onSubmit={(event) => void save(event)}
      >
        {error && (
          <div className="inventory-error" role="alert">
            {error}
          </div>
        )}
        <label>
          {copy('Warehouse name')}
          <Input
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <footer className="products-dialog-footer">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {copy('Cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? copy('Saving…') : copy(warehouse ? 'Save changes' : 'Add warehouse')}
          </Button>
        </footer>
      </form>
    </DashboardDialog>
  );
}
