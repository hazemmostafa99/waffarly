import type { CatalogCategorySummary, CatalogMediaAsset } from '@waffarly/contracts';
import { BasicInformationTab } from './BasicInformationTab.js';
import { ProductDetailsTab } from './ProductDetailsTab.js';

export function ProductInformationTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  basePrice,
  onBasePriceChange,
  productMode,
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
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  basePrice: string;
  onBasePriceChange: (value: string) => void;
  productMode: 'simple' | 'variants';
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
    <div className="builder-fields product-information-step">
      <div className="builder-section-heading">
        <span>{text('01', '01')}</span>
        <div>
          <h2>{text('Product information', 'معلومات المنتج')}</h2>
          <p>
            {text(
              'Add the name and price, then choose where it appears and how customers recognize it.',
              'أضف الاسم والسعر، ثم اختر تصنيف المنتج وصوره التي سيراها العملاء.',
            )}
          </p>
        </div>
      </div>
      <BasicInformationTab
        name={name}
        onNameChange={onNameChange}
        description={description}
        onDescriptionChange={onDescriptionChange}
        basePrice={basePrice}
        onBasePriceChange={onBasePriceChange}
        productMode={productMode}
        text={text}
      />
      <ProductDetailsTab
        categories={categories}
        categoryIds={categoryIds}
        onCategoryIdsChange={onCategoryIdsChange}
        media={media}
        imageAssetIds={imageAssetIds}
        primaryImageAssetId={primaryImageAssetId}
        onImageIdsChange={onImageIdsChange}
        onPrimaryImageChange={onPrimaryImageChange}
        onUpload={onUpload}
        uploading={uploading}
        text={text}
      />
    </div>
  );
}
