import { type ChangeEvent } from 'react';
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
  return (
    <div className="builder-fields">
      <div className="builder-section-heading">
        <span>{text('02', '02')}</span>
        <div>
          <h2>{text('Product details', 'تفاصيل المنتج')}</h2>
          <p>
            {text(
              'Organize the product and add photos from your library or device.',
              'نظّم المنتج وأضف صوره من المكتبة أو من جهازك.',
            )}
          </p>
        </div>
      </div>
      <fieldset className="builder-choice-fieldset">
        <legend>
          {text('Categories', 'التصنيفات')} <i>*</i>
        </legend>
        {categories.length ? (
          <div className="builder-category-grid">
            {categories.map((category) => (
              <label
                className={`builder-category-choice ${categoryIds.includes(category.id) ? 'selected' : ''}`}
                key={category.id}
              >
                <input
                  type="checkbox"
                  checked={categoryIds.includes(category.id)}
                  onChange={(event) =>
                    onCategoryIdsChange(toggleList(categoryIds, category.id, event.target.checked))
                  }
                />
                <span className="builder-check-mark">✓</span>
                <strong>{category.name}</strong>
              </label>
            ))}
          </div>
        ) : (
          <p className="builder-empty-state">
            {text(
              'No categories yet. Create one before continuing.',
              'لا توجد تصنيفات بعد. أنشئ تصنيفاً للمتابعة.',
            )}
          </p>
        )}
      </fieldset>
      <fieldset className="builder-choice-fieldset">
        <legend>
          {text('Product images', 'صور المنتج')} <i>*</i>
        </legend>
        <p className="builder-helper-copy">
          {text(
            'Choose up to 10 images and mark one as the primary image.',
            'اختر حتى 10 صور وحدد واحدة كصورة رئيسية.',
          )}
        </p>
        <label className={`builder-upload-button ${uploading ? 'disabled' : ''}`}>
          <Icon name="upload" />
          {uploading
            ? text('Uploading…', 'جارٍ الرفع…')
            : text('Upload from this device', 'رفع صورة من الجهاز')}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || imageAssetIds.length >= 10}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];
              if (file) void onUpload(file);
              event.target.value = '';
            }}
          />
        </label>
        {media.length ? (
          <div className="builder-media-grid">
            {media.map((asset) => {
              const checked = imageAssetIds.includes(asset.id);
              return (
                <article
                  className={`builder-media-choice ${checked ? 'selected' : ''}`}
                  key={asset.id}
                >
                  <label className="builder-media-image">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && imageAssetIds.length >= 10}
                      onChange={(event) =>
                        onImageIdsChange(toggleList(imageAssetIds, asset.id, event.target.checked))
                      }
                    />
                    <img src={asset.publicUrl} alt={asset.storageKey} loading="lazy" />
                  </label>
                  <div className="builder-media-meta">
                    <span title={asset.storageKey}>{asset.storageKey.split(/[\\/]/).pop()}</span>
                    {checked && (
                      <label>
                        <input
                          type="radio"
                          name="primary-image"
                          checked={primaryImageAssetId === asset.id}
                          onChange={() => onPrimaryImageChange(asset.id)}
                        />
                        {text('Primary', 'رئيسية')}
                      </label>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="builder-empty-state">
            {text(
              'No images yet. Upload one from your device.',
              'لا توجد صور بعد. ارفع صورة من جهازك.',
            )}
          </p>
        )}
      </fieldset>
    </div>
  );
}

function toggleList(ids: string[], id: string, checked: boolean) {
  return checked ? [...ids, id] : ids.filter((value) => value !== id);
}
