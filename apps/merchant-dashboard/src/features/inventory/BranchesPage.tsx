import { Fragment, useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  DashboardCard,
  Input,
  useLocale,
} from '@waffarly/ui';
import type { InventoryBranch, InventoryWarehouse } from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import { Icon } from '../../Icons.js';
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
  const [expandedBranchId, setExpandedBranchId] = useState('');
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
        setExpandedBranchId((currentId) =>
          page.items.some((branch) => branch.id === currentId)
            ? currentId
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

  useEffect(() => {
    const nextSearch = searchDraft.trim();
    if (nextSearch === search) return;
    const timer = window.setTimeout(() => {
      setSearch(nextSearch);
      setHistory([]);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, searchDraft]);

  function changed(branch: InventoryBranch, message: string) {
    setExpandedBranchId(branch.id);
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

  const branchFilters = (
    <div className="inventory-filters">
      <div className="inventory-branch-search">
        <label className="sr-only" htmlFor="branch-search">
          {text('Search branches')}
        </label>
        <div className="inventory-branch-search-control">
          <Icon name="search" />
          <Input
            id="branch-search"
            aria-label={text('Search branches')}
            type="search"
            value={searchDraft}
            maxLength={160}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={text('Search by branch name')}
          />
          {searchDraft && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="inventory-branch-search-clear"
              aria-label={text('Clear search')}
              onClick={() => setSearchDraft('')}
            >
              <span aria-hidden="true">×</span>
            </Button>
          )}
        </div>
      </div>
      <label className="inventory-filter-status">
        <span className="sr-only">{text('Status')}</span>
        <select
          aria-label={text('Branch status')}
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
  );

  return (
    <main className="inventory-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <InventoryHeader
        title="Branches and warehouses"
        description="Each branch can hold multiple warehouses and has one default consumption warehouse."
        showInventoryNavigation={false}
        filters={branchFilters}
        actions={
          <Button
            type="button"
            onClick={() => setBranchEditor({ branch: null, key: crypto.randomUUID() })}
          >
            <Icon name="plus" />
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
        <div
          className="wf-table-scroll inventory-branch-table-scroll"
          role="region"
          aria-label={text('Branch directory')}
          tabIndex={0}
        >
          <table className="wf-data-table inventory-branch-table" aria-busy={loading}>
            <caption className="wf-sr-only">{text('Branch directory')}</caption>
            <thead>
              <tr>
                <th scope="col">{text('Branch')}</th>
                <th scope="col">{text('Warehouses')}</th>
                <th scope="col">{text('Status')}</th>
                <th scope="col">{text('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="wf-table-state" role="status">
                    {text('Loading branches…')}
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={4} className="wf-table-state" role="status">
                    {listError
                      ? text('Could not load branches.')
                      : search || status !== 'active' ? (
                          <div className="inventory-branch-empty">
                            <span>{text('No branches match these filters.')}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSearchDraft('');
                                setSearch('');
                                setStatus('active');
                                setHistory([]);
                              }}
                            >
                              {text('Clear filters')}
                            </Button>
                          </div>
                        ) : (
                          text('No branches yet. Add a branch to begin.')
                        )}
                  </td>
                </tr>
              ) : (
                branches.map((branch) => {
                  const expanded = expandedBranchId === branch.id;
                  const activeWarehouses = branch.warehouses.filter(
                    (warehouse) => !warehouse.archivedAt,
                  );
                  const defaultWarehouse = branch.warehouses.find(
                    (warehouse) => warehouse.isDefaultConsumption,
                  );
                  const detailsId = 'branch-warehouses-' + branch.id;
                  return (
                    <Fragment key={branch.id}>
                      <tr className={expanded ? 'is-expanded' : undefined}>
                        <td className="inventory-branch-name-cell">
                          <button
                            type="button"
                            className="inventory-branch-toggle"
                            aria-expanded={expanded}
                            aria-controls={detailsId}
                            onClick={() =>
                              setExpandedBranchId((current) =>
                                current === branch.id ? '' : branch.id,
                              )
                            }
                          >
                            <span className="inventory-branch-chevron" aria-hidden="true">
                              <span />
                            </span>
                            <span className="inventory-table-name">
                              <strong>{formatDigits(branch.name)}</strong>
                              <small>
                                {branch.address
                                  ? formatDigits(branch.address)
                                  : text('No address provided.')}
                              </small>
                            </span>
                          </button>
                        </td>
                        <td className="inventory-branch-warehouse-cell">
                          <div className="inventory-branch-warehouse-summary">
                            <small className="inventory-branch-mobile-label">
                              {text('Warehouses')}
                            </small>
                            <span className="inventory-warehouse-count">
                              {formatDigits(String(activeWarehouses.length))}
                            </span>
                            <small>
                              {formatDigits(defaultWarehouse?.name ?? text('No default warehouse'))}
                            </small>
                          </div>
                        </td>
                        <td className="inventory-branch-status-cell">
                          <small className="inventory-branch-mobile-label">
                            {text('Status')}
                          </small>
                          <span
                            className={
                              'inventory-location-status ' +
                              (branch.archivedAt ? 'is-archived' : 'is-active')
                            }
                          >
                            {text(branch.archivedAt ? 'Archived' : 'Active')}
                          </span>
                        </td>
                        <td className="inventory-action-cell inventory-branch-action-cell">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={Boolean(branch.archivedAt)}
                            onClick={() => setBranchEditor({ branch, key: branch.id })}
                          >
                            {text('Edit')}
                          </Button>
                        </td>
                      </tr>
                      <tr
                        className="inventory-branch-expanded-row"
                        id={detailsId}
                        hidden={!expanded}
                      >
                        <td colSpan={4}>
                          <section
                            className="inventory-branch-expansion"
                            aria-label={text('Warehouses')}
                          >
                            <div className="inventory-branch-expansion-heading">
                              <div>
                                <h3>
                                  {text('Warehouses')}
                                  <span className="inventory-section-count">
                                    {formatDigits(String(activeWarehouses.length))}
                                  </span>
                                </h3>
                                <p>
                                  {text('The default warehouse is used for future recipe consumption.')}
                                </p>
                              </div>
                              <div className="inventory-row-actions">
                                {!branch.archivedAt && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      setWarehouseEditor({
                                        warehouse: null,
                                        branch,
                                        key: crypto.randomUUID(),
                                      })
                                    }
                                  >
                                    {text('Add warehouse')}
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setArchiveTarget({ branch })}
                                >
                                  {branch.archivedAt
                                    ? text('Restore branch')
                                    : text('Archive branch')}
                                </Button>
                              </div>
                            </div>
                            <ul className="inventory-branch-warehouse-list">
                              {branch.warehouses.length === 0 ? (
                                <li className="inventory-branch-warehouse-empty">
                                  {text('No warehouses yet.')}
                                </li>
                              ) : (
                                branch.warehouses.map((warehouse) => (
                                  <li key={warehouse.id}>
                                    <div className="inventory-warehouse-main">
                                      <strong>
                                        {formatDigits(warehouse.name)}
                                        {warehouse.isDefaultConsumption && (
                                          <small className="inventory-warehouse-tag is-default">
                                            {text('Default consumption warehouse')}
                                          </small>
                                        )}
                                        {warehouse.archivedAt && (
                                          <small className="inventory-warehouse-tag is-archived">
                                            {text('Archived')}
                                          </small>
                                        )}
                                      </strong>
                                      {warehouse.isDefaultConsumption && !warehouse.archivedAt && (
                                        <small className="inventory-warehouse-help">
                                          {text(
                                            'Choose another default before archiving this warehouse.',
                                          )}
                                        </small>
                                      )}
                                    </div>
                                    <div className="inventory-row-actions">
                                      {!warehouse.archivedAt &&
                                        !warehouse.isDefaultConsumption && (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={busy || Boolean(branch.archivedAt)}
                                            onClick={() =>
                                              void saveWarehouseDefault(branch, warehouse)
                                            }
                                          >
                                            {text('Set as default')}
                                          </Button>
                                        )}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy || Boolean(branch.archivedAt)}
                                        onClick={() =>
                                          setWarehouseEditor({ warehouse, branch, key: warehouse.id })
                                        }
                                      >
                                        {text('Edit')}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={
                                          busy ||
                                          Boolean(branch.archivedAt) ||
                                          (!warehouse.archivedAt && warehouse.isDefaultConsumption)
                                        }
                                        onClick={() => setArchiveTarget({ branch, warehouse })}
                                      >
                                        {warehouse.archivedAt ? text('Restore') : text('Archive')}
                                      </Button>
                                    </div>
                                  </li>
                                ))
                              )}
                            </ul>
                          </section>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
            <p className="inventory-archive-target">
              <strong>
                {('warehouse' in archiveTarget ? text('Warehouse') : text('Branch')) + ': '}
                {formatDigits(
                  'warehouse' in archiveTarget
                    ? archiveTarget.warehouse.name
                    : archiveTarget.branch.name,
                )}
              </strong>
            </p>
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
  const [nameError, setNameError] = useState('');
  const [defaultWarehouseError, setDefaultWarehouseError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const branchName = name.trim();
    const defaultName = defaultWarehouseName.trim();
    setNameError(branchName ? '' : copy('Enter a branch name.'));
    setDefaultWarehouseError(
      !branch && !defaultName ? copy('Enter a default warehouse name.') : '',
    );
    if (!branchName || (!branch && !defaultName)) return;
    setBusy(true);
    try {
      const updated = branch
        ? await apiRequest<InventoryBranch>(`/owner/inventory/branches/${branch.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              revision: branch.revision,
              name: branchName,
              address: address.trim(),
            }),
          })
        : await apiRequest<InventoryBranch>('/owner/inventory/branches', {
            method: 'POST',
            body: JSON.stringify({
              name: branchName,
              address: address.trim(),
              defaultWarehouseName: defaultName,
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
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'branch-name-error' : undefined}
            onInvalid={(event) => {
              event.preventDefault();
              setNameError(copy('Enter a branch name.'));
            }}
            onChange={(event) => {
              setName(event.target.value);
              if (event.target.value.trim()) setNameError('');
            }}
          />
          {nameError && (
            <small className="inventory-field-error" id="branch-name-error">
              {nameError}
            </small>
          )}
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
              aria-invalid={Boolean(defaultWarehouseError)}
              aria-describedby={
                defaultWarehouseError ? 'default-warehouse-name-error' : undefined
              }
              onInvalid={(event) => {
                event.preventDefault();
                setDefaultWarehouseError(copy('Enter a default warehouse name.'));
              }}
              onChange={(event) => {
                setDefaultWarehouseName(event.target.value);
                if (event.target.value.trim()) setDefaultWarehouseError('');
              }}
            />
            {defaultWarehouseError && (
              <small className="inventory-field-error" id="default-warehouse-name-error">
                {defaultWarehouseError}
              </small>
            )}
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
  const [nameError, setNameError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const warehouseName = name.trim();
    setNameError(warehouseName ? '' : copy('Enter a warehouse name.'));
    if (!warehouseName) return;
    setBusy(true);
    try {
      const updated = warehouse
        ? await apiRequest<InventoryBranch>(
            `/owner/inventory/branches/${branch.id}/warehouses/${warehouse.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ revision: warehouse.revision, name: warehouseName }),
            },
          )
        : await apiRequest<InventoryBranch>(`/owner/inventory/branches/${branch.id}/warehouses`, {
            method: 'POST',
            body: JSON.stringify({ revision: branch.revision, name: warehouseName }),
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
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'warehouse-name-error' : undefined}
            onInvalid={(event) => {
              event.preventDefault();
              setNameError(copy('Enter a warehouse name.'));
            }}
            onChange={(event) => {
              setName(event.target.value);
              if (event.target.value.trim()) setNameError('');
            }}
          />
          {nameError && (
            <small className="inventory-field-error" id="warehouse-name-error">
              {nameError}
            </small>
          )}
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
