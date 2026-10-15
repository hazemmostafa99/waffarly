import type {
  CatalogCategorySummary,
  CatalogMediaAsset,
  ProductInventoryMode,
} from '@waffarly/contracts';
import { Icon } from '../../../Icons.js';
import type { GroupDraft, VariantDraft } from './product-builder.types.js';

export function PreviewPublishTab({
  onEditStep,
  name,
  description,
  basePrice,
  availability,
  onAvailabilityChange,
  categories,
  images,
  groups,
  variants,
  inventoryMode,
  inventoryConfigured,
  formatNumber,
  text,
}: {
  onEditStep: (step: number) => void;
  name: string;
  description: string;
  basePrice: string;
  availability: 'available' | 'unavailable';
  onAvailabilityChange: (value: 'available' | 'unavailable') => void;
  categories: CatalogCategorySummary[];
  images: CatalogMediaAsset[];
  groups: GroupDraft[];
  variants: VariantDraft[];
  inventoryMode: ProductInventoryMode;
  inventoryConfigured: boolean;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  text: (english: string, arabic: string) => string;
}) {
  return (
    <div className="builder-fields">
      <div className="builder-section-heading">
        <span>{text('05', '05')}</span>
        <div>
          <h2>{text('Preview and publish', 'المعاينة والنشر')}</h2>
          <p>
            {text(
              'Review the product details and choose whether it is available for sale.',
              'راجع تفاصيل المنتج واختر ما إذا كان متاحاً للبيع.',
            )}
          </p>
        </div>
      </div>
      <div className="builder-review-card">
        <div className="builder-review-images">
          {images.slice(0, 4).map((image) => (
            <img
              src={image.publicUrl}
              key={image.id}
              alt={name || text('Product image', 'صورة المنتج')}
            />
          ))}
          {!images.length && (
            <div className="builder-review-image-empty">
              <Icon name="image" />
              <span>{text('No product image', 'لا توجد صورة للمنتج')}</span>
            </div>
          )}
        </div>
        <div className="builder-review-copy">
          <div className="builder-review-categories">
            {categories.map((category) => (
              <span key={category.id}>{category.name}</span>
            ))}
          </div>
          <span className={`builder-availability-pill ${availability}`}>
            {availability === 'available'
              ? text('Available for sale', 'متاح للبيع')
              : text('Not available for sale', 'غير متاح للبيع')}
          </span>
          <h3>{name || text('Product name', 'اسم المنتج')}</h3>
          <p>{description || text('No description added.', 'لم تتم إضافة وصف.')}</p>
          {variants.length ? (
            <div className="builder-review-variants">
              <strong>{text('Variant prices', 'أسعار المتغيرات')}</strong>
              {variants.map((variant) => (
                <span key={variant.id}>
                  {variant.name || text('Unnamed variant', 'متغير بلا اسم')} —{' '}
                  <b dir="ltr">
                    EGP{' '}
                    {formatNumber(Number(variant.price || 0), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </b>
                  {variant.stockQuantity !== '' &&
                    ` · ${text('Stock', 'المخزون')}: ${text(variant.stockQuantity, variant.stockQuantity)}`}
                </span>
              ))}
            </div>
          ) : (
            <strong dir="ltr">
              EGP{' '}
              {formatNumber(Number(basePrice || 0), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
          )}
          <small>{text('Sold per piece', 'يباع بالقطعة')}</small>
        </div>
      </div>
      <div
        className="builder-review-actions"
        role="group"
        aria-label={text('Edit product sections', 'تعديل أقسام المنتج')}
      >
        <button type="button" className="builder-button" onClick={() => onEditStep(0)}>
          {text('Edit name & price', 'تعديل الاسم والسعر')}
        </button>
        <button type="button" className="builder-button" onClick={() => onEditStep(1)}>
          {text('Edit photos & categories', 'تعديل الصور والتصنيفات')}
        </button>
        <button type="button" className="builder-button" onClick={() => onEditStep(2)}>
          {text('Edit customer choices', 'تعديل خيارات العميل')}
        </button>
        <button type="button" className="builder-button" onClick={() => onEditStep(3)}>
          {text('Edit inventory setup', 'تعديل إعداد المخزون')}
        </button>
      </div>
      <div className="builder-review-groups builder-inventory-review">
        <h3>{text('Inventory setup', 'إعداد المخزون')}</h3>
        <strong>
          {inventoryConfigured
            ? inventoryMode === 'RECIPE'
              ? text('Recipe configured', 'تم إعداد الوصفة')
              : text('Direct item mapping configured', 'تم إعداد الربط المباشر')
            : text('Not configured', 'غير مُعدّ')}
        </strong>
      </div>
      {groups.length > 0 && (
        <div className="builder-review-groups">
          <h3>
            {text('Customer choices', 'اختيارات العميل')}
            <span className="builder-count-badge">
              {text(String(groups.length), String(groups.length))}
            </span>
          </h3>
          {groups.map((group) => (
            <article key={group.id}>
              <strong>{group.name || text('Unnamed group', 'مجموعة بدون اسم')}</strong>
              <small>
                {text(String(group.minSelections), String(group.minSelections))}–
                {text(String(group.maxSelections), String(group.maxSelections))}{' '}
                {text('choices', 'اختيارات')} ·{' '}
                {group.selectionMode === 'single'
                  ? text('Single choice', 'اختيار واحد')
                  : text('Multiple choice', 'اختيارات متعددة')}
              </small>
              <p>
                {group.options
                  .map(
                    (option) =>
                      `${option.name || text('Unnamed choice', 'اختيار بدون اسم')} (+ EGP ${formatNumber(Number(option.priceAdjustment || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
                  )
                  .join(' · ')}
              </p>
            </article>
          ))}
        </div>
      )}
      {!groups.length && (
        <div className="builder-review-groups builder-review-empty-card">
          <h3>
            {text('Customer choices', 'اختيارات العميل')}
            <span className="builder-count-badge">{text('0', '0')}</span>
          </h3>
          <p className="builder-review-empty">
            {text(
              'No add-ons or extra choices for this product.',
              'لا توجد إضافات أو خيارات أخرى لهذا المنتج.',
            )}
          </p>
        </div>
      )}
      <fieldset className="builder-availability-fieldset">
        <legend>{text('Sales availability', 'حالة توفر المنتج')}</legend>
        <label
          className={`builder-availability-choice ${availability === 'available' ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name="availability"
            checked={availability === 'available'}
            onChange={() => onAvailabilityChange('available')}
          />
          <span>
            <strong>{text('Available', 'متاح للبيع')}</strong>
            <small>
              {text(
                'Customers can order this product after creation.',
                'يمكن للعملاء طلب المنتج بعد إنشائه.',
              )}
            </small>
          </span>
        </label>
        <label
          className={`builder-availability-choice ${availability === 'unavailable' ? 'selected' : ''}`}
        >
          <input
            type="radio"
            name="availability"
            checked={availability === 'unavailable'}
            onChange={() => onAvailabilityChange('unavailable')}
          />
          <span>
            <strong>{text('Unavailable', 'غير متاح للبيع')}</strong>
            <small>
              {text(
                'Keep it in your catalog without accepting orders.',
                'احتفظ به في الكتالوج دون قبول الطلبات.',
              )}
            </small>
          </span>
        </label>
      </fieldset>
    </div>
  );
}
