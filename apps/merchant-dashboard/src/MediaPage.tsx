import { useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pagination, formatNumber as formatLocalizedNumber, useLocale } from '@waffarly/ui';
import type { Category, MediaAsset, Product } from './CatalogWorkspace.js';
import { DashboardDialog } from './components/DashboardDialog.js';
import { Icon } from './Icons.js';
import { apiRequest, apiUpload } from './lib/api-client.js';
import { mediaCopy } from './media-copy.js';

type FileKind = 'images' | 'videos' | 'documents' | 'other';
const kinds: { id: FileKind; label: string; formats: string; icon: string }[] = [
  { id: 'images', label: 'Images', formats: 'JPG, PNG, WEBP', icon: 'image' },
  { id: 'videos', label: 'Videos', formats: 'MP4, MOV', icon: 'video' },
  { id: 'documents', label: 'Documents', formats: 'PDF, DOC', icon: 'file' },
  { id: 'other', label: 'Other', formats: 'ZIP, AI, PSD', icon: 'file' },
];
const pageSize = 12;
const initialDraft = { publicUrl: '', storageKey: '', mimeType: 'image/jpeg', sizeBytes: '' };

function fileKind(asset: MediaAsset): FileKind {
  if (asset.mimeType.startsWith('image/')) return 'images';
  if (asset.mimeType.startsWith('video/')) return 'videos';
  if (/pdf|word|document|text\//.test(asset.mimeType)) return 'documents';
  return 'other';
}

function fileName(asset: MediaAsset): string {
  return asset.storageKey.split(/[\\/]/).pop() || asset.storageKey;
}

function fileFormat(asset: MediaAsset): string {
  const mime = asset.mimeType.split('/')[1]?.split(';')[0] ?? '';
  return (mime === 'jpeg' ? 'jpg' : mime).toUpperCase();
}

function getFileSize(bytes: number, locale: string): string {
  if (bytes === 0) return `${formatLocalizedNumber(0, locale)} B`;
  const unit = Math.min(3, Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))));
  return `${formatLocalizedNumber(bytes / 1024 ** unit, locale, { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB'][unit]}`;
}

function safeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function MediaThumbnail({ asset, preview = false }: { asset: MediaAsset; preview?: boolean }) {
  const [failed, setFailed] = useState(false);
  const kind = fileKind(asset);
  if (kind === 'images' && !failed) {
    return (
      <img
        src={asset.publicUrl}
        alt={fileName(asset)}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  if (kind === 'videos' && preview) {
    return <video src={asset.publicUrl} controls preload="metadata" />;
  }
  return (
    <span className={`media-file-placeholder ${kind}`}>
      <Icon name={kinds.find((item) => item.id === kind)!.icon} />
      <b>{fileFormat(asset)}</b>
    </span>
  );
}

export function MediaPage() {
  const { search: globalSearch } = useOutletContext<{ search: string }>();
  const { locale, errorText, formatNumber } = useLocale();
  const fileSize = (bytes: number) => getFileSize(bytes, locale);
  const copy = (message: string) => mediaCopy(message, locale);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [usage, setUsage] = useState('');
  const [format, setFormat] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [dialog, setDialog] = useState<'add' | 'storage' | 'selection' | null>(null);
  const [addMode, setAddMode] = useState<'upload' | 'url'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [nextMedia, nextProducts, nextCategories] = await Promise.all([
        apiRequest<MediaAsset[]>('/owner/catalog/media'),
        apiRequest<Product[]>('/owner/catalog/products'),
        apiRequest<Category[]>('/owner/catalog/categories'),
      ]);
      setMedia(nextMedia);
      setProducts(nextProducts);
      setCategories(nextCategories);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load media.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    setPage(1);
    setMenu(null);
  }, [query, globalSearch, type, usage, format]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.media-card-actions'))
        setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);

  const productIds = new Set(
    products.flatMap((product) => product.images.map((image) => image.mediaAssetId)),
  );
  const categoryIds = new Set(categories.map((category) => category.image.id));
  const assetUsage = (asset: MediaAsset) =>
    productIds.has(asset.id) ? 'product' : categoryIds.has(asset.id) ? 'category' : 'library';
  const usageLabel = (asset: MediaAsset) =>
    copy(
      fileKind(asset) !== 'images'
        ? kinds.find((kind) => kind.id === fileKind(asset))!.label
        : assetUsage(asset) === 'product'
          ? 'Product image'
          : assetUsage(asset) === 'category'
            ? 'Category image'
            : 'Library image',
    );
  const filtered = media.filter(
    (asset) =>
      [query, globalSearch].every((term) =>
        fileName(asset).toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()),
      ) &&
      (!type || fileKind(asset) === type) &&
      (!format || fileFormat(asset) === format) &&
      (!usage ||
        (usage === 'product'
          ? productIds.has(asset.id)
          : usage === 'category'
            ? categoryIds.has(asset.id)
            : !productIds.has(asset.id) && !categoryIds.has(asset.id))),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totals = kinds.map((kind) => ({
    ...kind,
    count: media.filter((asset) => fileKind(asset) === kind.id).length,
    bytes: media
      .filter((asset) => fileKind(asset) === kind.id)
      .reduce((sum, asset) => sum + asset.sizeBytes, 0),
  }));
  const totalBytes = totals.reduce((sum, kind) => sum + kind.bytes, 0);
  const storageTotals = [
    totals[0]!,
    totals[1]!,
    { ...totals[3]!, bytes: totals[2]!.bytes + totals[3]!.bytes },
  ];
  let cumulative = 0;
  const colors = ['#00a676', '#258cff', '#f4b23e'];
  const gradient = storageTotals
    .map((kind, index) => {
      const start = cumulative;
      cumulative += totalBytes ? (kind.bytes / totalBytes) * 100 : 0;
      return `${colors[index]} ${start}% ${cumulative}%`;
    })
    .join(', ');

  function clearFilters() {
    setQuery('');
    setType('');
    setUsage('');
    setFormat('');
  }
  async function copyLink(asset: MediaAsset) {
    setMenu(null);
    try {
      await navigator.clipboard.writeText(asset.publicUrl);
      setNotice('Link copied.');
    } catch {
      setNotice('Could not copy link. Open the original file to copy its URL.');
    }
  }
  async function addImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    let url: string | undefined;
    let bytes: number | undefined;
    if (addMode === 'upload') {
      if (!selectedFile) {
        setFormError('Choose an image file to upload.');
        return;
      }
      if (
        selectedFile.size <= 0 ||
        selectedFile.size > 10 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)
      ) {
        setFormError('Choose a JPEG, PNG, or WebP image up to 10 MB.');
        return;
      }
    } else {
      url = safeUrl(draft.publicUrl);
      bytes = Number(draft.sizeBytes);
      if (!url) {
        setFormError('Use a valid public HTTP or HTTPS image URL.');
        return;
      }
      if (!Number.isInteger(bytes) || bytes <= 0 || bytes > 10 * 1024 * 1024) {
        setFormError('Image size must be greater than zero and at most 10 MB.');
        return;
      }
      if (draft.storageKey.trim().length > 255) {
        setFormError('File name must be at most 255 characters.');
        return;
      }
    }
    setBusy(true);
    try {
      const asset =
        addMode === 'upload'
          ? await apiUpload<MediaAsset>('/owner/catalog/media/upload', selectedFile!)
          : await apiRequest<MediaAsset>('/owner/catalog/media', {
              method: 'POST',
              body: JSON.stringify({
                ...draft,
                storageKey: draft.storageKey.trim(),
                publicUrl: url,
                sizeBytes: bytes,
              }),
            });
      setMedia((current) => [asset, ...current]);
      clearFilters();
      setPage(1);
      setDialog(null);
      setAddMode('upload');
      setSelectedFile(null);
      setDraft(initialDraft);
      setNotice(addMode === 'upload' ? 'Image uploaded to this server.' : 'Image added.');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not add image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="media-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="sr-only">{copy('Media Library')}</h1>
      <div className="media-toolbar">
      <div className="media-filters">
        <label className="products-search">
          <Icon name="search" />
          <input
            aria-label={copy('Search media')}
            placeholder={copy('Search by file name…')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label={copy('File type')}
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">{copy('All types')}</option>
          {kinds.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {copy(kind.label)}
            </option>
          ))}
        </select>
        <select
          aria-label={copy('Usage')}
          value={usage}
          onChange={(event) => setUsage(event.target.value)}
        >
          <option value="">{copy('All usages')}</option>
          <option value="product">{copy('Product images')}</option>
          <option value="category">{copy('Category images')}</option>
          <option value="library">{copy('Library images')}</option>
        </select>
        <select
          aria-label={copy('Format')}
          value={format}
          onChange={(event) => setFormat(event.target.value)}
        >
          <option value="">{copy('All formats')}</option>
          {[...new Set(media.map(fileFormat))].sort().map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
        <div className="media-toolbar-actions">
        <button
          type="button"
          className="products-button primary"
          onClick={() => {
            setDialog('add');
            setAddMode('upload');
            setSelectedFile(null);
            setFormError('');
          }}
        >
          <Icon name="upload" />
          {copy('Add media')}
        </button>
        </div>
      </div>
      {notice && (
        <p className="media-notice" role="status">
          {copy(notice)}
        </p>
      )}
      {selected.length > 0 && (
        <div className="media-selection">
          <strong>
            {formatNumber(selected.length)} {copy('selected')}
          </strong>
          <button type="button" onClick={() => setDialog('selection')}>
            {copy('Selected files')}
          </button>
          <button type="button" onClick={() => setSelected([])}>
            {copy('Clear selection')}
          </button>
        </div>
      )}
      <div className="media-workspace">
        <section className="media-gallery" aria-label={copy('Media Library')} aria-busy={loading}>
          {loading ? (
            <div className="media-empty" role="status">
              <Icon name="image" />
              <p>{copy('Loading media…')}</p>
            </div>
          ) : error ? (
            <div className="media-empty">
              <p className="products-error" role="alert">
                {copy(errorText(error))}
              </p>
              <button type="button" className="products-button" onClick={() => void refresh()}>
                {copy('Retry')}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="media-empty">
              <Icon name="image" />
              <h2>{copy(media.length ? 'No matching files' : 'Your media library starts here')}</h2>
              <p>
                {copy(
                  media.length
                    ? 'Try another search or clear your filters.'
                    : 'Add your first image to bring your catalog to life.',
                )}
              </p>
              <button
                type="button"
                className="products-button"
                onClick={
                  media.length
                    ? clearFilters
                    : () => {
                        setDialog('add');
                        setAddMode('upload');
                        setSelectedFile(null);
                        setFormError('');
                      }
                }
              >
                {copy(media.length ? 'Clear filters' : 'Add image')}
              </button>
            </div>
          ) : (
            <div className="media-grid">
              {visible.map((asset) => (
                <article
                  className={`media-card ${selected.includes(asset.id) ? 'is-selected' : ''}`}
                  key={asset.id}
                >
                  <div className="media-card-thumbnail">
                    <button
                      type="button"
                      className="media-preview-button"
                      aria-label={`${copy('Preview')} ${fileName(asset)}`}
                      onClick={() => setPreview(asset)}
                    >
                      <MediaThumbnail asset={asset} />
                    </button>
                    <input
                      className="media-checkbox"
                      type="checkbox"
                      aria-label={`${copy('Select')} ${fileName(asset)}`}
                      checked={selected.includes(asset.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, asset.id]
                            : current.filter((id) => id !== asset.id),
                        )
                      }
                    />
                    <div className="media-card-actions">
                      <button
                        type="button"
                        className="media-more"
                        aria-label={`${copy('File actions')} ${fileName(asset)}`}
                        aria-expanded={menu === asset.id}
                        aria-controls={`media-menu-${asset.id}`}
                        onClick={() => setMenu(menu === asset.id ? null : asset.id)}
                      >
                        <Icon name="more" />
                      </button>
                      {menu === asset.id && (
                        <div className="media-menu" id={`media-menu-${asset.id}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setPreview(asset);
                              setMenu(null);
                            }}
                          >
                            <Icon name="eye" />
                            {copy('Preview')}
                          </button>
                          {safeUrl(asset.publicUrl) && (
                            <a
                              href={safeUrl(asset.publicUrl)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setMenu(null)}
                            >
                              <Icon name="arrow" />
                              {copy('Open original')}
                            </a>
                          )}
                          <button type="button" onClick={() => void copyLink(asset)}>
                            <Icon name="link" />
                            {copy('Copy link')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="media-card-info">
                    <button
                      type="button"
                      className="media-file-name"
                      title={fileName(asset)}
                      onClick={() => setPreview(asset)}
                      dir="ltr"
                    >
                      {fileName(asset)}
                    </button>
                    <div className="media-card-footer">
                      <div>
                        <span className={`media-usage ${assetUsage(asset)}`}>
                          {usageLabel(asset)}
                        </span>
                        <small dir="ltr">
                          {fileFormat(asset)} · {fileSize(asset.sizeBytes)}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="media-type-icon"
                        aria-label={`${copy('Preview')} ${fileName(asset)}`}
                        onClick={() => setPreview(asset)}
                      >
                        <Icon name={kinds.find((kind) => kind.id === fileKind(asset))!.icon} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={(next) => {
                setPage(next);
                setMenu(null);
              }}
              label={copy('Pagination')}
              pageLabel={(item) => `${copy('Page')} ${item}`}
              previousLabel={copy('Previous page')}
              nextLabel={copy('Next page')}
            />
          )}
        </section>
        <aside className="media-summary" aria-label={copy('Storage space')}>
          <section className="media-summary-card">
            <h2>{copy('Storage space')}</h2>
            <div
              className="media-storage-ring"
              style={{ background: totalBytes ? `conic-gradient(${gradient})` : '#eef0f2' }}
            >
              <div>
                <strong dir="ltr">{loading || error ? '—' : fileSize(totalBytes)}</strong>
                <small>{copy('Total library size')}</small>
              </div>
            </div>
            <ul className="media-storage-legend">
              {storageTotals.map((kind, index) => (
                <li key={kind.id}>
                  <i style={{ background: colors[index] }} />
                  <span>{copy(kind.id === 'other' ? 'Other files' : kind.label)}</span>
                  <b dir="ltr">{loading || error ? '—' : fileSize(kind.bytes)}</b>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="media-storage-button"
              onClick={() => setDialog('storage')}
              disabled={loading || !!error}
            >
              <Icon name="settings" />
              {copy('Storage details')}
            </button>
          </section>
          <section className="media-summary-card">
            <h2>{copy('File types')}</h2>
            <div className="media-types">
              {totals.map((kind) => (
                <button
                  type="button"
                  className={`media-type-row ${kind.id} ${type === kind.id ? 'active' : ''}`}
                  key={kind.id}
                  aria-pressed={type === kind.id}
                  onClick={() => setType(type === kind.id ? '' : kind.id)}
                >
                  <span className="media-kind-icon">
                    <Icon name={kind.icon} />
                  </span>
                  <span>
                    {copy(kind.label)}
                    <small dir="ltr">{kind.formats}</small>
                  </span>
                  <b>{loading || error ? '—' : formatNumber(kind.count)}</b>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
      {dialog === 'add' && (
        <DashboardDialog
          title={copy('Add image')}
          closeLabel={copy('Close')}
          onClose={() => setDialog(null)}
          busy={busy}
        >
          <form className="products-form media-add-form" onSubmit={(event) => void addImage(event)}>
            <div className="media-add-modes" role="group" aria-label={copy('Add media method')}>
              <button
                type="button"
                aria-pressed={addMode === 'upload'}
                onClick={() => {
                  setAddMode('upload');
                  setFormError('');
                }}
              >
                {copy('Upload from device')}
              </button>
              <button
                type="button"
                aria-pressed={addMode === 'url'}
                onClick={() => {
                  setAddMode('url');
                  setFormError('');
                }}
              >
                {copy('Add by URL')}
              </button>
            </div>
            <p>
              {copy(
                addMode === 'upload'
                  ? 'Choose an image from your device. It will be stored on this server. JPEG, PNG, and WebP up to 10 MB are supported.'
                  : 'Add a hosted image using its public URL. JPEG, PNG, and WebP images up to 10 MB are supported.',
              )}
            </p>
            <fieldset className="products-fields" disabled={busy}>
              {addMode === 'upload' ? (
                <label>
                  {copy('Choose image')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  {selectedFile && (
                    <small dir="ltr">
                      {selectedFile.name} · {fileSize(selectedFile.size)}
                    </small>
                  )}
                </label>
              ) : (
                <>
                  <label>
                    {copy('Image URL')}
                    <input
                      required
                      type="url"
                      maxLength={2000}
                      placeholder="https://…"
                      dir="ltr"
                      value={draft.publicUrl}
                      onChange={(event) => setDraft({ ...draft, publicUrl: event.target.value })}
                    />
                  </label>
                  <label>
                    {copy('File name')}
                    <input
                      required
                      maxLength={255}
                      dir="ltr"
                      placeholder="product-image.jpg"
                      value={draft.storageKey}
                      onChange={(event) => setDraft({ ...draft, storageKey: event.target.value })}
                    />
                  </label>
                  <div className="products-form-grid">
                    <label>
                      {copy('File size in bytes')}
                      <input
                        required
                        type="number"
                        lang="en"
                        dir="ltr"
                        min={1}
                        max={10 * 1024 * 1024}
                        step={1}
                        value={draft.sizeBytes}
                        onChange={(event) => setDraft({ ...draft, sizeBytes: event.target.value })}
                      />
                    </label>
                    <label>
                      {copy('Format')}
                      <select
                        value={draft.mimeType}
                        onChange={(event) => setDraft({ ...draft, mimeType: event.target.value })}
                      >
                        <option value="image/jpeg">JPEG</option>
                        <option value="image/png">PNG</option>
                        <option value="image/webp">WebP</option>
                      </select>
                    </label>
                  </div>
                </>
              )}
            </fieldset>
            {formError && (
              <p className="products-error" role="alert">
                {copy(errorText(formError))}
              </p>
            )}
            <footer>
              <button
                type="button"
                className="products-button"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                {copy('Cancel')}
              </button>
              <button type="submit" className="products-button primary" disabled={busy}>
                {copy(
                  busy
                    ? addMode === 'upload'
                      ? 'Uploading…'
                      : 'Adding…'
                    : addMode === 'upload'
                      ? 'Upload image'
                      : 'Add image',
                )}
              </button>
            </footer>
          </form>
        </DashboardDialog>
      )}
      {preview && (
        <DashboardDialog
          title={fileName(preview)}
          closeLabel={copy('Close')}
          onClose={() => setPreview(null)}
        >
          <div className="media-detail-preview">
            <MediaThumbnail asset={preview} preview />
          </div>
          <div className="media-preview-meta">
            <span className={`media-usage ${assetUsage(preview)}`}>{usageLabel(preview)}</span>
            <span dir="ltr">
              {fileFormat(preview)} · {fileSize(preview.sizeBytes)}
            </span>
          </div>
          <footer>
            <button
              type="button"
              className="products-button"
              onClick={() => void copyLink(preview)}
            >
              {copy('Copy link')}
            </button>
            {safeUrl(preview.publicUrl) && (
              <a
                className="products-button primary"
                href={safeUrl(preview.publicUrl)}
                target="_blank"
                rel="noreferrer"
              >
                {copy('Open original')}
              </a>
            )}
          </footer>
        </DashboardDialog>
      )}
      {dialog === 'storage' && (
        <DashboardDialog
          title={copy('Storage details')}
          closeLabel={copy('Close')}
          onClose={() => setDialog(null)}
        >
          <div className="media-storage-details">
            <p>
              {formatNumber(media.length)} {copy('Files in your library')}{' '}
              <strong dir="ltr">{fileSize(totalBytes)}</strong>
            </p>
            {totals.map((kind) => (
              <div key={kind.id}>
                <span>{copy(kind.label)}</span>
                <b>{formatNumber(kind.count)}</b>
                <strong dir="ltr">{fileSize(kind.bytes)}</strong>
              </div>
            ))}
          </div>
        </DashboardDialog>
      )}
      {dialog === 'selection' && (
        <DashboardDialog
          title={copy('Selected files')}
          closeLabel={copy('Close')}
          onClose={() => setDialog(null)}
        >
          <div className="media-selected-files">
            {media
              .filter((asset) => selected.includes(asset.id))
              .map((asset) => (
                <div key={asset.id}>
                  <strong dir="ltr">{fileName(asset)}</strong>
                  <span dir="ltr">{fileSize(asset.sizeBytes)}</span>
                  {safeUrl(asset.publicUrl) && (
                    <a href={safeUrl(asset.publicUrl)} target="_blank" rel="noreferrer">
                      {copy('Open original')}
                    </a>
                  )}
                </div>
              ))}
          </div>
        </DashboardDialog>
      )}
    </div>
  );
}
