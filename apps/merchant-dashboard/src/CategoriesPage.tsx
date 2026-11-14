import { useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Button,
  DashboardCard,
  DataTable,
  Pagination,
  SummaryCard,
  useLocale,
  type DataTableColumn,
} from '@waffarly/ui';
import type { Category, MediaAsset, Product } from './CatalogWorkspace.js';
import { categoriesCopy } from './categories-copy.js';
import { DashboardDialog } from './components/DashboardDialog.js';
import { MediaImagePickerDialog } from './components/MediaImagePickerDialog.js';
import { Icon } from './Icons.js';
import { apiRequest, apiUpload } from './lib/api-client.js';

const pageSize = 10;

type CategoryDraft = {
  name: string;
  description: string;
  parentId: string;
  availability: string;
  imageAssetId: string;
};

function categoryDraft(category: Category | null): CategoryDraft {
  return {
    name: category?.name ?? '',
    description: category?.description ?? '',
    parentId: category?.parentId ?? '',
    availability: category?.availability ?? 'available',
    imageAssetId: category?.image.id ?? '',
  };
}

export function CategoriesPage() {
  const { search: globalSearch } = useOutletContext<{ search: string }>();
  const { locale, errorText, formatNumber } = useLocale();
  const copy = (message: string) => categoriesCopy(message, locale);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CategoryDraft>(() => categoryDraft(null));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const activeCategories = categories.filter((category) => !category.archivedAt);
  const selected = categories.find((category) => category.id === selectedId) ?? null;

  function productCount(category: Category): number {
    return (
      category.productCount ??
      products.filter((product) =>
        product.categories.some((productCategory) => productCategory.id === category.id),
      ).length
    );
  }

  async function refresh(preferredId?: string) {
    const [nextCategories, nextProducts, nextMedia] = await Promise.all([
      apiRequest<Category[]>('/owner/catalog/categories'),
      apiRequest<Product[]>('/owner/catalog/products'),
      apiRequest<MediaAsset[]>('/owner/catalog/media'),
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
    setMedia(nextMedia);
    setHasLoaded(true);
    const nextId =
      preferredId && nextCategories.some((category) => category.id === preferredId)
        ? preferredId
        : selectedId && nextCategories.some((category) => category.id === selectedId)
          ? selectedId
          : (nextCategories.find((category) => !category.archivedAt)?.id ??
            nextCategories[0]?.id ??
            null);
    setSelectedId(nextId);
    if (!creating) {
      setDraft(categoryDraft(nextCategories.find((category) => category.id === nextId) ?? null));
    }
  }

  useEffect(() => {
    void refresh()
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load categories.'),
      )
      .finally(() => setLoading(false));
  }, []);

  function selectCategory(category: Category) {
    setCreating(false);
    setSelectedId(category.id);
    setDraft(categoryDraft(category));
    setError('');
    setNotice('');
  }

  function startCreating() {
    setCreating(true);
    setSelectedId(null);
    setDraft(categoryDraft(null));
    setError('');
    setNotice('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await apiRequest<Category>(
        `/owner/catalog/categories${selected ? `/${selected.id}` : ''}`,
        {
          method: selected ? 'PATCH' : 'POST',
          body: JSON.stringify({
            name: draft.name,
            description: draft.description,
            parentId: draft.parentId || null,
            availability: draft.availability,
            imageAssetId: draft.imageAssetId,
            ...(selected ? { revision: selected.revision } : {}),
          }),
        },
      );
      setCreating(false);
      setSelectedId(saved.id);
      setNotice('Category saved.');
      await refresh(saved.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save category.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/owner/catalog/categories/${selected.id}`, { method: 'DELETE' });
      setNotice('Category deleted.');
      setDeleteOpen(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save category.');
    } finally {
      setBusy(false);
    }
  }

  async function changeArchiveState(action: 'archive' | 'restore') {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await apiRequest<Category>(
        `/owner/catalog/categories/${selected.id}/${action}`,
        {
          method: 'POST',
          body: JSON.stringify({ revision: selected.revision }),
        },
      );
      setNotice(action === 'archive' ? 'Category archived.' : 'Category restored as unavailable.');
      await refresh(saved.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update category lifecycle.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadCategoryImage(file: File): Promise<MediaAsset> {
    const asset = await apiUpload<MediaAsset>('/owner/catalog/media/upload', file);
    setMedia((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
    return asset;
  }

  const normalizedQueries = [query, globalSearch].map((value) =>
    value.trim().toLocaleLowerCase(locale),
  );
  const filtered = categories
    .filter(
      (category) =>
        normalizedQueries.every((value) =>
          `${category.name} ${category.description ?? ''}`
            .toLocaleLowerCase(locale)
            .includes(value),
        ) &&
        (!status ||
          (status === 'archived'
            ? Boolean(category.archivedAt)
            : !category.archivedAt && category.availability === status)),
    )
    .sort((a, b) => {
      if (sort === 'products') return productCount(b) - productCount(a);
      if (a.parentId === null && b.parentId !== null) return -1;
      if (a.parentId !== null && b.parentId === null) return 1;
      return a.name.localeCompare(b.name, locale);
    });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filterKey = `${query}\0${globalSearch}\0${status}\0${sort}`;
  useEffect(() => setPage(1), [filterKey]);

  const columns: DataTableColumn<Category>[] = [
    {
      id: 'category',
      header: copy('Category'),
      cell: (category) => (
        <button
          type="button"
          className={`categories-name-button ${selectedId === category.id ? 'categories-row-selected' : ''}`}
          onClick={() => selectCategory(category)}
        >
          <img src={category.image.publicUrl} alt="" loading="lazy" />
          <strong>{category.name}</strong>
          {category.childCount ? <Icon name="arrow" /> : null}
        </button>
      ),
    },
    {
      id: 'parent',
      header: copy('Parent'),
      cell: (category) => (
        <span className="categories-parent">
          {category.parent?.name ??
            categories.find((item) => item.id === category.parentId)?.name ??
            '—'}
        </span>
      ),
    },
    {
      id: 'products',
      header: copy('Products'),
      cell: (category) => <strong className="categories-count">{productCount(category)}</strong>,
    },
    {
      id: 'status',
      header: copy('Status'),
      cell: (category) => {
        const label = category.archivedAt
          ? 'Archived'
          : category.availability === 'available'
            ? 'Active'
            : 'Inactive';
        return (
          <span
            className={`products-pill ${!category.archivedAt && category.availability === 'available' ? 'mint' : 'cream'}`}
          >
            {copy(label)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: copy('Actions'),
      cell: (category) => (
        <button
          type="button"
          className="categories-action"
          aria-label={`${copy('Category details')}: ${category.name}`}
          onClick={() => selectCategory(category)}
        >
          <Icon name="more" />
        </button>
      ),
    },
  ];

  const rootCategories = activeCategories.filter(
    (category) => category.parentId === null && category.id !== selected?.id,
  );
  const selectedImage = media.find((asset) => asset.id === draft.imageAssetId) ?? null;

  return (
    <div className="categories-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="sr-only">{copy('Categories')}</h1>

      {error && (
        <div className="products-error" role="alert">
          {errorText(copy(error))}
          <button
            type="button"
            className="products-button"
            disabled={busy}
            onClick={() => {
              setError('');
              setLoading(true);
              void refresh()
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : 'Could not load categories.'),
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

      <div className="products-stats categories-stats">
        <SummaryCard
          label={copy('Active Categories')}
          value={
            loading || !hasLoaded
              ? '—'
              : activeCategories.filter((category) => category.availability === 'available').length
          }
          tone="cream"
          icon={<Icon name="eye" />}
          detail={`↑ 6% ${copy('Compared with last month')}`}
        />
        <SummaryCard
          label={copy('Subcategories')}
          value={
            loading || !hasLoaded
              ? '—'
              : activeCategories.filter((category) => category.parentId !== null).length
          }
          tone="mint"
          icon={<Icon name="layers" />}
          detail={`↑ 9% ${copy('Compared with last month')}`}
        />
        <SummaryCard
          label={copy('Main Categories')}
          value={
            loading || !hasLoaded
              ? '—'
              : activeCategories.filter((category) => category.parentId === null).length
          }
          tone="blue"
          icon={<Icon name="tag" />}
          detail={`↑ 20% ${copy('Compared with last month')}`}
        />
        <SummaryCard
          label={copy('Total Categories')}
          value={loading || !hasLoaded ? '—' : activeCategories.length}
          tone="rose"
          icon={<Icon name="box" />}
          detail={`↑ 12% ${copy('Compared with last month')}`}
        />
      </div>

      <div className="categories-toolbar">
        <div className="categories-filters">
          <label className="products-search">
            <Icon name="search" />
            <input
              aria-label={copy('Search categories')}
              placeholder={copy('Search categories…')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            aria-label={copy('All statuses')}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{copy('All statuses')}</option>
            <option value="available">{copy('Active')}</option>
            <option value="unavailable">{copy('Inactive')}</option>
            <option value="archived">{copy('Archived')}</option>
          </select>
          <select
            aria-label={copy('Sort by')}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="name">{copy('Name A–Z')}</option>
            <option value="products">{copy('Most products')}</option>
          </select>
        </div>
        <div className="categories-toolbar-actions">
          <button
            type="button"
            className="products-button primary"
            disabled={loading || busy || !hasLoaded}
            onClick={startCreating}
          >
            <Icon name="plus" /> {copy('Add Category')}
          </button>
        </div>
      </div>

      <div className="categories-workspace">
        <DashboardCard
          title={copy('Category list')}
          description={`${formatNumber(filtered.length)} ${copy('categories')}`}
          className="categories-list-card"
        >
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(category) => category.id}
            caption={copy('Category list')}
            loading={loading}
            loadingState={copy('Loading categories…')}
            emptyState={copy(
              categories.length
                ? 'No matching categories.'
                : 'No categories yet. Add your first category to get started.',
            )}
          />
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            disabled={busy || loading}
            label={copy('Category pagination')}
            pageLabel={(value) => `${copy('Page')} ${value}`}
            previousLabel={copy('Previous page')}
            nextLabel={copy('Next page')}
            summary={(start, end, total) =>
              `${copy('Showing')} ${formatNumber(start)}–${formatNumber(end)} ${copy('of')} ${formatNumber(total)} ${copy('categories')}`
            }
          />
        </DashboardCard>

        <DashboardCard
          title={copy('Category details')}
          description={copy('Edit category details and visibility settings')}
          className="categories-editor-card"
        >
          {!selected && !creating ? (
            <p className="categories-empty-editor">{copy('Select a category to edit it.')}</p>
          ) : (
            <form className="categories-form" onSubmit={(event) => void save(event)}>
              <fieldset disabled={busy || Boolean(selected?.archivedAt)}>
                <label>
                  {copy('Category name')}
                  <input
                    required
                    maxLength={160}
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </label>
                <label>
                  {copy('Description')}
                  <textarea
                    maxLength={1000}
                    rows={3}
                    placeholder={copy('Description placeholder')}
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  />
                  <small>
                    {formatNumber(draft.description.length)}/{formatNumber(1000)}
                  </small>
                </label>
                <label>
                  {copy('Parent category')}
                  <select
                    value={draft.parentId}
                    onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}
                  >
                    <option value="">{copy('No parent (main category)')}</option>
                    {rootCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="categories-visibility">
                  <div>
                    <strong>{copy('Visibility')}</strong>
                    <small>{copy('Show this category in the store')}</small>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.availability === 'available'}
                    className="categories-switch"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        availability:
                          draft.availability === 'available' ? 'unavailable' : 'available',
                      })
                    }
                  >
                    <span />
                  </button>
                </div>
                <div className="categories-images">
                  <div className="categories-image-copy">
                    <strong>{copy('Cover image')}</strong>
                    <small>{copy('Choose a clear image to represent this category.')}</small>
                  </div>
                  <div className="categories-image-control">
                    {selectedImage ? (
                      <img src={selectedImage.publicUrl} alt="" />
                    ) : (
                      <span className="categories-image-placeholder">
                        <Icon name="image" />
                      </span>
                    )}
                    <div>
                      <strong>
                        {selectedImage ? copy('Image selected') : copy('No image selected')}
                      </strong>
                      <small>
                        {selectedImage
                          ? selectedImage.storageKey.split(/[\\/]/).pop()
                          : copy('A category image is required.')}
                      </small>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || Boolean(selected?.archivedAt)}
                        onClick={() => setImagePickerOpen(true)}
                      >
                        <Icon name={selectedImage ? 'edit' : 'image'} />
                        {copy(selectedImage ? 'Change image' : 'Choose image')}
                      </Button>
                    </div>
                  </div>
                </div>
              </fieldset>
              <button
                type="submit"
                className="products-button primary categories-save"
                disabled={busy || !draft.imageAssetId || Boolean(selected?.archivedAt)}
              >
                {copy('Save changes')}
              </button>
              {selected && (
                <>
                  <button
                    type="button"
                    className="products-button"
                    disabled={busy}
                    onClick={() =>
                      void changeArchiveState(selected.archivedAt ? 'restore' : 'archive')
                    }
                  >
                    {copy(selected.archivedAt ? 'Restore category' : 'Archive category')}
                  </button>
                  {!selected.archivedAt && (
                    <button
                      type="button"
                      className="categories-delete"
                      disabled={busy}
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Icon name="trash" />
                      {copy('Delete category')}
                    </button>
                  )}
                </>
              )}
            </form>
          )}
        </DashboardCard>
      </div>

      {imagePickerOpen && (
        <MediaImagePickerDialog
          assets={media}
          selectedId={draft.imageAssetId}
          copy={copy}
          errorText={errorText}
          onClose={() => setImagePickerOpen(false)}
          onApply={(asset) => setDraft((current) => ({ ...current, imageAssetId: asset.id }))}
          onUpload={uploadCategoryImage}
        />
      )}

      {deleteOpen && selected && (
        <DashboardDialog
          title={copy('Delete this category?')}
          closeLabel={copy('Cancel')}
          onClose={() => setDeleteOpen(false)}
          busy={busy}
        >
          <p>
            {copy(
              'Only a category without products or subcategories can be deleted. This cannot be undone.',
            )}
          </p>
          <footer>
            <button
              type="button"
              className="products-button"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
            >
              {copy('Cancel')}
            </button>
            <button
              type="button"
              className="products-button primary"
              onClick={() => void deleteCategory()}
              disabled={busy}
            >
              {copy('Delete')}
            </button>
          </footer>
        </DashboardDialog>
      )}
    </div>
  );
}
