import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  DashboardCard,
  SummaryCard,
  DataTable,
  Pagination,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import type { CatalogSnapshot, Product } from './CatalogWorkspace.js';
import { apiRequest } from './lib/api-client.js';
import { Icon } from './Icons.js';
import { ProductImport } from './ProductImport.js';
import { DashboardDialog } from './components/DashboardDialog.js';
import { productsCopy } from './products-copy.js';

const pageSize = 6;
const palette = ['#f3a628', '#e34e5b', '#357beb', '#06936d', '#8796b4'];

export function ProductsPage() {
  const { search: globalSearch } = useOutletContext<{ search: string }>();
  const navigate = useNavigate();
  const { locale, errorText } = useLocale();
  const copy = (text: string) => productsCopy(text, locale);
  const [catalog, setCatalog] = useState<CatalogSnapshot>({
    products: [],
    categories: [],
    media: [],
  });
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [products, categories, media] = await Promise.all([
      apiRequest<CatalogSnapshot['products']>('/owner/catalog/products'),
      apiRequest<CatalogSnapshot['categories']>('/owner/catalog/categories'),
      apiRequest<CatalogSnapshot['media']>('/owner/catalog/media'),
    ]);
    setCatalog({ products, categories, media });
    setHasLoaded(true);
    setSelected((ids) =>
      ids.filter((id) => products.some((product) => product.id === id && !product.archivedAt)),
    );
  }
  async function reloadAfterSave(message: string) {
    setNotice(message);
    try {
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load products.');
    }
  }
  useEffect(() => {
    void refresh()
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load products.'),
      )
      .finally(() => setLoading(false));
  }, []);

  const products = catalog.products.filter((product) => !product.archivedAt);
  const published = products.filter((product) => product.availability === 'available').length;
  const filteredSource =
    status === 'archived' ? catalog.products.filter((product) => product.archivedAt) : products;
  const filtered = filteredSource
    .filter((product) => {
      const text = `${product.name} ${product.id}`.toLocaleLowerCase(locale);
      return (
        [query, globalSearch].every((search) =>
          text.includes(search.trim().toLocaleLowerCase(locale)),
        ) &&
        (!category || product.categories.some((item) => item.id === category)) &&
        (!status || status === 'archived' || product.availability === status)
      );
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, locale)
        : (Number(a.basePrice) - Number(b.basePrice)) * (sort === 'price-desc' ? -1 : 1),
    );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectableVisible = visible.filter((product) => !product.archivedAt);
  const allSelected =
    selectableVisible.length > 0 &&
    selectableVisible.every((product) => selected.includes(product.id));
  const someSelected = selectableVisible.some((product) => selected.includes(product.id));
  const filterKey = `${query}\0${globalSearch}\0${category}\0${status}\0${sort}`;
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [filterKey]);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const distribution = [
    ...products
      .reduce((counts, product) => {
        const main = product.categories[0];
        const id = main?.id ?? 'uncategorized';
        const existing = counts.get(id);
        counts.set(id, {
          id,
          name: main?.name ?? copy('Uncategorized'),
          count: (existing?.count ?? 0) + 1,
        });
        return counts;
      }, new Map<string, { id: string; name: string; count: number }>())
      .values(),
  ].sort((a, b) => b.count - a.count);
  let angle = 0;
  const chartStops = distribution.map((item, index) => {
    const start = angle;
    angle += (item.count / products.length) * 360;
    return `${palette[index % palette.length]} ${start}deg ${angle}deg`;
  });
  async function updateSelected(action: 'available' | 'unavailable' | 'archive') {
    setBusy(true);
    setError('');
    setNotice('');
    let failed = false;
    try {
      for (const product of products.filter((item) => selected.includes(item.id))) {
        try {
          await apiRequest(
            `/owner/catalog/products/${product.id}${action === 'archive' ? '/archive' : ''}`,
            {
              method: action === 'archive' ? 'POST' : 'PATCH',
              body: JSON.stringify({
                revision: product.revision,
                ...(action === 'archive' ? {} : { availability: action }),
              }),
            },
          );
        } catch {
          failed = true;
        }
      }
      await refresh();
      setSelected([]);
      if (failed) setError('Some products could not be updated. Refresh and try again.');
      else setNotice('Products updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load products.');
    } finally {
      setBusy(false);
      setArchiveOpen(false);
    }
  }
  async function restoreProduct(product: Product) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/owner/catalog/products/${product.id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ revision: product.revision }),
      });
      await refresh();
      setNotice('Product restored as unavailable.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restore product.');
    } finally {
      setBusy(false);
    }
  }
  const columns: DataTableColumn<Product>[] = [
    {
      id: 'select',
      className: 'products-select-cell',
      header: (
        <input
          ref={selectAllRef}
          type="checkbox"
          aria-label={copy('Select all on this page')}
          checked={allSelected}
          disabled={busy || !visible.length}
          onChange={(event) =>
            setSelected((ids) =>
              event.target.checked
                ? [...new Set([...ids, ...selectableVisible.map((product) => product.id)])]
                : ids.filter((id) => !selectableVisible.some((product) => product.id === id)),
            )
          }
        />
      ),
      cell: (product) => (
        <input
          type="checkbox"
          aria-label={`${copy('Select')} ${product.name}`}
          checked={selected.includes(product.id)}
          disabled={busy || Boolean(product.archivedAt)}
          onChange={(event) =>
            setSelected((ids) =>
              event.target.checked ? [...ids, product.id] : ids.filter((id) => id !== product.id),
            )
          }
        />
      ),
    },
    {
      id: 'product',
      header: copy('Product'),
      cell: (product) => {
        const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
        return (
          <div className="products-identity">
            {image ? (
              <img src={image.publicUrl} alt="" loading="lazy" />
            ) : (
              <span className="products-thumb-empty">
                <Icon name="box" />
              </span>
            )}
            <span>
              <strong>{product.name}</strong>
              <small dir="ltr">ID: {product.id.slice(0, 8)}</small>
            </span>
          </div>
        );
      },
    },
    {
      id: 'category',
      header: copy('Category'),
      cell: (product) => (
        <span className="products-pill cream">
          {product.categories[0]?.name ?? copy('Uncategorized')}
        </span>
      ),
    },
    {
      id: 'price',
      header: copy('Base price'),
      className: 'products-price',
      cell: (product) => <span dir="ltr">EGP {Number(product.basePrice).toFixed(2)}</span>,
    },
    {
      id: 'status',
      header: copy('Status'),
      cell: (product) => {
        const label = product.archivedAt
          ? 'Archived'
          : product.availability === 'available'
            ? 'Available'
            : 'Unavailable';
        return (
          <span
            className={`products-pill ${!product.archivedAt && product.availability === 'available' ? 'mint' : 'cream'}`}
          >
            {copy(label)}
          </span>
        );
      },
    },
    {
      id: 'categories',
      header: copy('Categories'),
      cell: (product) => (
        <span className="products-pill blue">
          {product.categories.length} {copy('Categories')}
        </span>
      ),
    },
    {
      id: 'edit',
      header: copy('Edit'),
      cell: (product) =>
        product.archivedAt ? (
          <button
            type="button"
            className="products-button"
            aria-label={`${copy('Restore')} ${product.name}`}
            disabled={busy}
            onClick={() => void restoreProduct(product)}
          >
            {copy('Restore')}
          </button>
        ) : (
          <button
            type="button"
            className="products-icon-button"
            aria-label={`${copy('Edit')} ${product.name}`}
            disabled={busy}
            onClick={() => navigate(`/products/${product.id}/edit`)}
          >
            <Icon name="edit" />
          </button>
        ),
    },
  ];
  return (
    <div className="products-page">
      <header className="products-heading">
        <div>
          <h1>{copy('Products')}</h1>
          <p>{copy('Manage products, prices, categories, and availability.')}</p>
        </div>
        <div className="products-heading-actions">
          <button
            type="button"
            className="products-button primary"
            disabled={loading || busy || !hasLoaded}
            onClick={() => navigate('/products/new')}
          >
            <Icon name="plus" />
            {copy('Add Product')}
          </button>
          <button
            type="button"
            className="products-button"
            disabled={loading || busy || !hasLoaded}
            onClick={() => setImportOpen(true)}
          >
            {copy('Import')}
          </button>
        </div>
      </header>
      {error && (
        <div className="products-error" role="alert">
          {errorText(copy(error))}{' '}
          <button
            className="products-button"
            disabled={busy}
            type="button"
            onClick={() => {
              setError('');
              setLoading(true);
              void refresh()
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : 'Could not load products.'),
                )
                .finally(() => setLoading(false));
            }}
          >
            {copy('Refresh')}
          </button>
        </div>
      )}
      {notice && (
        <p className="products-notice" role="status">
          {copy(notice)}
        </p>
      )}
      <div className="products-stats">
        <SummaryCard
          label={copy('Total Products')}
          value={loading || !hasLoaded ? '—' : products.length}
          tone="cream"
          icon={<Icon name="tag" />}
          detail={copy('Active catalog')}
        />
        <SummaryCard
          label={copy('Published')}
          value={loading || !hasLoaded ? '—' : published}
          tone="mint"
          icon={<Icon name="tag" />}
          detail={copy('Ready to sell')}
        />
        <SummaryCard
          label={copy('Hidden')}
          value={loading || !hasLoaded ? '—' : products.length - published}
          tone="blue"
          icon={<Icon name="tag" />}
          detail={copy('Not available for sale')}
        />
        <SummaryCard
          label={copy('Uncategorized')}
          value={
            loading || !hasLoaded
              ? '—'
              : products.filter((product) => !product.categories.length).length
          }
          tone="rose"
          icon={<Icon name="tag" />}
          detail={copy('Needs a category')}
        />
      </div>
      <div className="products-filters">
        <label className="products-search">
          <Icon name="search" />
          <input
            aria-label={copy('Search products')}
            placeholder={copy('Search by name or product ID…')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label={copy('Category')}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">{copy('All categories')}</option>
          {catalog.categories
            .filter((item) => !item.archivedAt)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <select
          aria-label={copy('Publication status')}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">{copy('All statuses')}</option>
          <option value="available">{copy('Available')}</option>
          <option value="unavailable">{copy('Unavailable')}</option>
          <option value="archived">{copy('Archived')}</option>
        </select>
        <select
          aria-label={copy('Sort')}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="name">{copy('Name A–Z')}</option>
          <option value="price-asc">{copy('Price: low to high')}</option>
          <option value="price-desc">{copy('Price: high to low')}</option>
        </select>
        <select
          aria-label={copy('Bulk actions')}
          value=""
          disabled={!selected.length || busy}
          onChange={(event) => {
            if (event.target.value === 'archive') setArchiveOpen(true);
            else if (event.target.value)
              void updateSelected(event.target.value as 'available' | 'unavailable');
          }}
        >
          <option value="">{copy('Bulk actions')}</option>
          <option value="available">{copy('Publish')}</option>
          <option value="unavailable">{copy('Hide')}</option>
          <option value="archive">{copy('Archive')}</option>
        </select>
      </div>
      {selected.length > 0 && (
        <div className="products-selection">
          <span>
            {selected.length} {copy('selected')}
          </span>
          <button
            type="button"
            className="products-button"
            disabled={busy}
            onClick={() => setSelected([])}
          >
            {copy('Clear selection')}
          </button>
        </div>
      )}
      <div className="products-content-grid">
        <DashboardCard title={copy('Products by category')} className="products-distribution">
          <div
            className="products-donut"
            role="img"
            aria-label={
              distribution.map((item) => `${item.name}: ${item.count}`).join(', ') ||
              copy('No category data yet.')
            }
            style={{
              background: chartStops.length
                ? `conic-gradient(${chartStops.join(', ')})`
                : '#eef2f4',
            }}
          >
            <div>
              <strong>{loading || !hasLoaded ? '—' : products.length}</strong>
              <small>{copy('Total Products')}</small>
            </div>
          </div>
          <ul className="products-legend">
            {distribution.map((item, index) => (
              <li key={item.id}>
                <span
                  className="products-legend-dot"
                  style={{ background: palette[index % palette.length] }}
                />
                <span>{item.name}</span>
                <strong>{Math.round((item.count / products.length) * 100)}%</strong>
              </li>
            ))}
          </ul>
          {!loading && !distribution.length && (
            <p className="products-empty-chart">{copy('No category data yet.')}</p>
          )}
        </DashboardCard>
        <DashboardCard
          title={copy('Product list')}
          className="products-table-card"
          action={
            <span className="products-result-count">
              {copy('Showing')} {visible.length} {copy('of')} {filtered.length} {copy('products')}
            </span>
          }
        >
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(product) => product.id}
            caption={copy('Product list')}
            loading={loading}
            loadingState={copy('Loading products…')}
            emptyState={
              !hasLoaded
                ? copy('Catalog data unavailable. Refresh to try again.')
                : copy(
                    catalog.products.length
                      ? 'No matching products.'
                      : 'No products yet. Add your first product to get started.',
                  )
            }
          />
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            disabled={busy || loading}
            label={copy('Product pagination')}
            pageLabel={(value) => `${copy('Page')} ${value}`}
            previousLabel={copy('Previous page')}
            nextLabel={copy('Next page')}
            summary={(start, end, total) =>
              `${copy('Showing')} ${start}–${end} ${copy('of')} ${total} ${copy('products')}`
            }
          />
        </DashboardCard>
      </div>
      {importOpen && (
        <ProductImport
          categories={catalog.categories}
          media={catalog.media}
          onClose={() => setImportOpen(false)}
          onImported={(complete) =>
            reloadAfterSave(complete ? 'Products imported.' : 'Some products imported.')
          }
        />
      )}
      {archiveOpen && (
        <DashboardDialog
          title={copy('Archive selected products?')}
          closeLabel={copy('Close')}
          onClose={() => setArchiveOpen(false)}
          busy={busy}
        >
          <p>{copy('Archived products will be removed from the active catalog.')}</p>
          <footer>
            <button
              type="button"
              className="products-button"
              disabled={busy}
              onClick={() => setArchiveOpen(false)}
            >
              {copy('Cancel')}
            </button>
            <button
              type="button"
              className="products-button primary"
              disabled={busy}
              onClick={() => void updateSelected('archive')}
            >
              {copy('Archive')} ({selected.length})
            </button>
          </footer>
        </DashboardDialog>
      )}
    </div>
  );
}
