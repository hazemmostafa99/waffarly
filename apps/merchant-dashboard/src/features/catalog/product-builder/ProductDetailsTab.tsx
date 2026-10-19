import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Dialog } from '@waffarly/ui';
import type { CatalogCategorySummary, CatalogMediaAsset } from '@waffarly/contracts';
import { Icon } from '../../../Icons.js';

export function ProductDetailsTab({
  categories,
  categoryIds,
  onCategoryIdsChange,
  media,
  imageAssetIds,
  primaryImageAssetId,
  onImageIdsChange,
  onPrimaryImageChange,
  onUpload,
  uploading,
  text,
}: {
  categories: CatalogCategorySummary[];
  categoryIds: string[];
  onCategoryIdsChange: (ids: string[]) => void;
  media: CatalogMediaAsset[];
  imageAssetIds: string[];
  primaryImageAssetId: string;
  onImageIdsChange: (ids: string[]) => void;
  onPrimaryImageChange: (id: string) => void;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  text: (english: string, arabic: string) => string;
}) {
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [mediaDialog, setMediaDialog] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const selectedCategories = categories.filter((category) => categoryIds.includes(category.id));
  const visibleCategories = categories.filter((category) =>
    category.name.toLocaleLowerCase().includes(categorySearch.trim().toLocaleLowerCase()),
  );
  const selectedImages = imageAssetIds
    .map((id) => media.find((asset) => asset.id === id))
    .filter((asset): asset is CatalogMediaAsset => Boolean(asset));

  useEffect(() => {
    if (!categoryOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !categoryRef.current?.contains(event.target))
        setCategoryOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoryOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [categoryOpen]);

  function toggleCategory(id: string, selected: boolean) {
    onCategoryIdsChange(
      selected ? [...categoryIds, id] : categoryIds.filter((current) => current !== id),
    );
  }
  function reorderImage(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= imageAssetIds.length) return;
    const next = [...imageAssetIds];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onImageIdsChange(next);
  }
  async function uploadFiles(files: FileList | File[]) {
    const remaining = Math.max(0, 10 - imageAssetIds.length);
    for (const file of Array.from(files).slice(0, remaining)) await onUpload(file);
  }
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!uploading) void uploadFiles(event.dataTransfer.files);
  }
  const textForAsset = (asset: CatalogMediaAsset) =>
    asset.storageKey.split(/[\\/]/).pop() || asset.storageKey;

  return (
    <div className="builder-fields product-details-fields">
      <fieldset className="builder-choice-fieldset product-category-fieldset">
        <legend>
          {text('Categories', 'التصنيفات')} <i>*</i>
        </legend>
        <div className="category-multiselect" ref={categoryRef}>
          <div className="category-chip-list">
            {selectedCategories.map((category) => (
              <span className="category-selected-chip" key={category.id}>
                {category.name}
                <button
                  type="button"
                  aria-label={text('Remove category ', 'إزالة التصنيف ') + category.name}
                  onClick={() => toggleCategory(category.id, false)}
                >
                  <Icon name="close" />
                </button>
              </span>
            ))}
            {!selectedCategories.length && (
              <span className="category-placeholder">
                {text('Choose one or more categories', 'اختر تصنيفًا واحدًا أو أكثر')}
              </span>
            )}
          </div>
          <button
            type="button"
            className="builder-button"
            aria-expanded={categoryOpen}
            onClick={() => setCategoryOpen((open) => !open)}
          >
            {categoryOpen ? text('Close', 'إغلاق') : text('Browse categories', 'استعراض التصنيفات')}
            <Icon name="chevron" />
          </button>
          {categoryOpen && (
            <div className="category-options-popover">
              <div className="category-search-wrap">
                <Icon name="search" />
                <input
                  type="search"
                  autoFocus
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  aria-label={text('Search categories', 'ابحث في التصنيفات')}
                  placeholder={text('Search categories…', 'ابحث عن تصنيف…')}
                />
              </div>
              {visibleCategories.length ? (
                <div className="category-options-list" role="listbox" aria-multiselectable="true">
                  {visibleCategories.map((category) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={categoryIds.includes(category.id)}
                      key={category.id}
                      onClick={() =>
                        toggleCategory(category.id, !categoryIds.includes(category.id))
                      }
                    >
                      <span
                        className={
                          categoryIds.includes(category.id)
                            ? 'category-option-check is-selected'
                            : 'category-option-check'
                        }
                      >
                        {categoryIds.includes(category.id) ? '✓' : ''}
                      </span>
                      {category.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="builder-empty-state">
                  {categories.length
                    ? text('No matching categories.', 'لا توجد تصنيفات مطابقة.')
                    : text('Create a category before continuing.', 'أنشئ تصنيفًا للمتابعة.')}
                </p>
              )}
            </div>
          )}
        </div>
        <small className="category-selection-hint">
          {selectedCategories.length
            ? text(
                String(selectedCategories.length) + ' selected',
                'تم اختيار ' + selectedCategories.length,
              )
            : text('Select at least one category.', 'اختر تصنيفًا واحدًا على الأقل.')}
        </small>
      </fieldset>

      <fieldset className="builder-choice-fieldset product-images-fieldset">
        <legend>
          {text('Product photos', 'صور المنتج')} <i>*</i>
        </legend>
        <div className="product-images-toolbar">
          <p className="builder-helper-copy">
            {text(
              'Add up to 10 photos. Drag to reorder, then choose the main photo.',
              'أضف حتى 10 صور. اسحب لإعادة الترتيب، ثم حدد الصورة الرئيسية.',
            )}
          </p>
          <button
            type="button"
            className="builder-button"
            disabled={!media.length || imageAssetIds.length >= 10}
            onClick={() => setMediaDialog(true)}
          >
            <Icon name="image" />
            {text('Choose from library', 'اختيار من المكتبة')}
          </button>
        </div>
        <div
          className={'product-image-dropzone' + (uploading ? ' is-uploading' : '')}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <Icon name="upload" />
          <strong>
            {uploading
              ? text('Uploading photo…', 'جارٍ رفع الصورة…')
              : text('Drop photos here', 'اسحب الصور إلى هنا')}
          </strong>
          <span>{text('or', 'أو')}</span>
          <label
            className={
              'builder-upload-button' + (uploading || imageAssetIds.length >= 10 ? ' disabled' : '')
            }
          >
            {text('Browse this device', 'تصفح الجهاز')}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || imageAssetIds.length >= 10}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                if (event.target.files) void uploadFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
          <small>
            {text(
              'JPEG, PNG or WebP · ' + imageAssetIds.length + '/10 selected',
              'JPEG أو PNG أو WebP · ' + imageAssetIds.length + '/10 صور',
            )}
          </small>
        </div>
        {selectedImages.length ? (
          <div className="selected-product-images">
            {selectedImages.map((asset, index) => (
              <article
                className={
                  'selected-product-image' + (primaryImageAssetId === asset.id ? ' is-primary' : '')
                }
                key={asset.id}
              >
                <img src={asset.publicUrl} alt={textForAsset(asset)} loading="lazy" />
                <div className="selected-product-image-caption">
                  <span title={textForAsset(asset)}>{textForAsset(asset)}</span>
                  {primaryImageAssetId === asset.id && (
                    <strong>{text('Main photo', 'الصورة الرئيسية')}</strong>
                  )}
                </div>
                <div className="selected-product-image-actions">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={text('Move photo earlier', 'نقل الصورة للأمام')}
                    onClick={() => reorderImage(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === selectedImages.length - 1}
                    aria-label={text('Move photo later', 'نقل الصورة للخلف')}
                    onClick={() => reorderImage(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={primaryImageAssetId === asset.id ? 'is-primary' : ''}
                    aria-pressed={primaryImageAssetId === asset.id}
                    onClick={() => onPrimaryImageChange(asset.id)}
                  >
                    {primaryImageAssetId === asset.id
                      ? text('Main', 'رئيسية')
                      : text('Set as main', 'تعيين كرئيسية')}
                  </button>
                  <button
                    type="button"
                    className="remove"
                    aria-label={text('Remove photo', 'إزالة الصورة')}
                    onClick={() => onImageIdsChange(imageAssetIds.filter((id) => id !== asset.id))}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="product-images-empty">
            {text(
              'Add your first photo from the library or your device.',
              'أضف صورتك الأولى من المكتبة أو الجهاز.',
            )}
          </div>
        )}
      </fieldset>
      {mediaDialog && (
        <MediaLibraryDialog
          media={media}
          selectedIds={imageAssetIds}
          text={text}
          onClose={() => setMediaDialog(false)}
          onApply={onImageIdsChange}
        />
      )}
    </div>
  );
}

function MediaLibraryDialog({
  media,
  selectedIds,
  text,
  onClose,
  onApply,
}: {
  media: CatalogMediaAsset[];
  selectedIds: string[];
  text: (english: string, arabic: string) => string;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [draftIds, setDraftIds] = useState(selectedIds);
  const filtered = useMemo(
    () =>
      media.filter((asset) =>
        asset.storageKey.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
      ),
    [media, search],
  );
  const toggle = (id: string) =>
    setDraftIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 10
          ? [...current, id]
          : current,
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={text('Choose product photos', 'اختيار صور المنتج')}
      description={text(
        'Select up to 10 photos. Your current selection is preserved until you apply.',
        'اختر حتى 10 صور. سيبقى اختيارك الحالي كما هو حتى تطبّقه.',
      )}
      closeLabel={text('Close photo library', 'إغلاق مكتبة الصور')}
      className="choice-composer-dialog media-library-dialog"
    >
      <div className="media-library-content">
        <label className="category-search-wrap">
          <Icon name="search" />
          <input
            type="search"
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={text('Search your media library…', 'ابحث في مكتبة الوسائط…')}
          />
        </label>
        <span className="media-library-count">
          {text(
            String(draftIds.length) + ' of 10 selected',
            'تم اختيار ' + draftIds.length + ' من 10',
          )}
        </span>
        {filtered.length ? (
          <div className="media-library-grid">
            {filtered.map((asset) => {
              const selected = draftIds.includes(asset.id);
              const title = asset.storageKey.split(/[\\/]/).pop() || asset.storageKey;
              return (
                <button
                  type="button"
                  className={'media-library-option' + (selected ? ' is-selected' : '')}
                  aria-pressed={selected}
                  key={asset.id}
                  onClick={() => toggle(asset.id)}
                >
                  <img src={asset.publicUrl} alt={title} loading="lazy" />
                  <span>
                    <span title={title}>{title}</span>
                    <i>{selected ? '✓' : ''}</i>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="product-images-empty">
            {text('No matching photos in the library.', 'لا توجد صور مطابقة في المكتبة.')}
          </div>
        )}
      </div>
      <footer className="choice-composer-footer">
        <button type="button" className="builder-button" onClick={onClose}>
          {text('Cancel', 'إلغاء')}
        </button>
        <button
          type="button"
          className="builder-button primary"
          onClick={() => {
            onApply(draftIds);
            onClose();
          }}
        >
          <Icon name="check" />
          {text('Apply selected photos', 'تطبيق الصور المختارة')}
        </button>
      </footer>
    </Dialog>
  );
}
