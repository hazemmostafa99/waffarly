import type {
  CatalogCategorySummary,
  CatalogMediaAsset,
  ProductInventoryMode,
} from '@waffarly/contracts';
import type { GroupDraft, VariantDraft } from './product-builder.types.js';

export function PreviewPublishTab({
  onEditStep,
  name,
  description,
  basePrice,
  productMode,
  availability,
  onAvailabilityChange,
  categories,
  images,
  groups,
  variants,
  inventoryMode,
  inventoryConfigured,
  inventoryRequired,
  formatNumber,
  text,
}: {
  onEditStep: (step: number) => void;
  name: string;
  description: string;
  basePrice: string;
  productMode: 'simple' | 'variants';
  availability: 'available' | 'unavailable';
  onAvailabilityChange: (value: 'available' | 'unavailable') => void;
  categories: CatalogCategorySummary[];
  images: CatalogMediaAsset[];
  groups: GroupDraft[];
  variants: VariantDraft[];
  inventoryMode: ProductInventoryMode;
  inventoryConfigured: boolean;
  inventoryRequired: boolean;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  text: (english: string, arabic: string) => string;
}) {
  const validPrice = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(basePrice) && Number(basePrice) > 0;
  const basicReady = Boolean(name.trim() && validPrice);
  const detailsReady = categories.length > 0 && images.length > 0;
  const informationReady = basicReady && detailsReady;
  const inventoryReady =
    inventoryConfigured || !inventoryRequired || availability === 'unavailable';
  const readyCount = [informationReady, inventoryReady].filter(Boolean).length;
  const priceText = (value: string) =>
    'EGP ' +
    formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const priceSummary = (value: string) =>
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value) && Number(value) > 0
      ? priceText(value)
      : text('Price not entered', 'لم يتم إدخال السعر');
  const status = (ready: boolean, optional = false) => (
    <span
      className={
        'review-status' + (ready ? ' is-ready' : optional ? ' is-optional' : ' is-missing')
      }
    >
      {ready
        ? text('Complete', 'مكتمل')
        : optional
          ? text('Optional', 'اختياري')
          : text('Needs attention', 'يحتاج إكمال')}
    </span>
  );
  return (
    <div className="builder-fields product-review-step">
      <div className="builder-section-heading">
        <span>{text('04', '04')}</span>
        <div>
          <h2>{text('Review and publish', 'المراجعة والنشر')}</h2>
          <p>
            {text(
              'Check the essentials, then choose how customers can buy this product.',
              'راجع التفاصيل الأساسية ثم حدد ما إذا كان المنتج متاحًا للعملاء.',
            )}
          </p>
        </div>
      </div>
      <div className={'review-readiness-banner' + (readyCount === 2 ? ' is-ready' : '')}>
        <div>
          <strong>
            {readyCount === 2
              ? text('Ready to save', 'جاهز للحفظ')
              : text('A few details need your attention', 'بعض التفاصيل تحتاج إلى إكمال')}
          </strong>
          <span>
            {text(
              String(readyCount) + ' of 2 required sections complete',
              'اكتمل ' + readyCount + ' من قسمين مطلوبين',
            )}
          </span>
        </div>
        {readyCount !== 2 && (
          <span className="review-required-note">
            {text(
              'Choose “Unavailable” to save without inventory setup.',
              'اختر «غير متاح» للحفظ دون إعداد المخزون.',
            )}
          </span>
        )}
      </div>

      <section className="product-review-section">
        <div className="product-review-section-heading">
          <div>
            <span className="review-section-number">01</span>
            <div>
              <h3>{text('Product information', 'معلومات المنتج')}</h3>
              <p>
                {text(
                  'Name, price, category and photos customers see.',
                  'الاسم والسعر والتصنيف والصور التي يراها العميل.',
                )}
              </p>
            </div>
          </div>
          {status(informationReady)}
          <button type="button" className="builder-button" onClick={() => onEditStep(0)}>
            {text('Edit', 'تعديل')}
          </button>
        </div>
        <div className="product-review-section-content">
          <strong>{name || text('Name not entered', 'لم يُكتب اسم المنتج')}</strong>
          {productMode === 'variants' ? (
            <span>
              {text('Size prices', 'أسعار الأحجام')} ·{' '}
              {variants.length
                ? variants
                    .map((variant) => variant.name + ' — ' + priceSummary(variant.price))
                    .join(' · ')
                : text('No sizes added', 'لم تتم إضافة أحجام')}
            </span>
          ) : (
            <span>{priceSummary(basePrice)}</span>
          )}
          {description && <small>{description}</small>}
          {categories.length ? (
            <div className="builder-review-categories">
              {categories.map((category) => (
                <span key={category.id}>{category.name}</span>
              ))}
            </div>
          ) : (
            <span>{text('No category selected', 'لم يتم اختيار تصنيف')}</span>
          )}
          <span>{text(String(images.length) + ' photos', String(images.length) + ' صور')}</span>
          <div className="review-photo-strip">
            {images.slice(0, 5).map((image) => (
              <img key={image.id} src={image.publicUrl} alt="" />
            ))}
            {images.length > 5 && <span>+{images.length - 5}</span>}
          </div>
        </div>
      </section>

      <section className="product-review-section">
        <div className="product-review-section-heading">
          <div>
            <span className="review-section-number">02</span>
            <div>
              <h3>{text('Sizes and customer choices', 'الأحجام وخيارات العميل')}</h3>
              <p>{text('Extra choices are optional.', 'الخيارات الإضافية اختيارية.')}</p>
            </div>
          </div>
          {status(true, true)}
          <button type="button" className="builder-button" onClick={() => onEditStep(1)}>
            {text('Edit', 'تعديل')}
          </button>
        </div>
        <div className="product-review-section-content">
          <span>
            {variants.length
              ? text(String(variants.length) + ' sizes', String(variants.length) + ' أحجام')
              : text('One product size', 'منتج بدون أحجام')}
          </span>
          <span>
            {groups.length
              ? text(
                  String(groups.length) + ' choice groups',
                  String(groups.length) + ' مجموعات خيارات',
                )
              : text('No extra choices', 'لا توجد خيارات إضافية')}
          </span>
        </div>
      </section>

      <section className="product-review-section">
        <div className="product-review-section-heading">
          <div>
            <span className="review-section-number">03</span>
            <div>
              <h3>{text('Inventory', 'المخزون')}</h3>
              <p>
                {text('What is used from stock per sale.', 'ما يُستهلك من المخزون لكل عملية بيع.')}
              </p>
            </div>
          </div>
          {status(inventoryConfigured, !inventoryRequired || availability === 'unavailable')}
          <button type="button" className="builder-button" onClick={() => onEditStep(2)}>
            {text('Edit', 'تعديل')}
          </button>
        </div>
        <div className="product-review-section-content">
          <span>
            {inventoryConfigured
              ? inventoryMode === 'RECIPE'
                ? text('Recipe is set up', 'تم إعداد الوصفة')
                : text('Ready-made item is linked', 'تم ربط الصنف الجاهز')
              : !inventoryRequired
                ? text(
                    'Inventory setup is optional for this product.',
                    'إعداد المخزون اختياري لهذا المنتج.',
                  )
                : text('Inventory is not set up', 'لم يتم إعداد المخزون')}
          </span>
        </div>
      </section>

      <fieldset className="builder-availability-fieldset review-availability">
        <legend>{text('Sales availability', 'حالة توفر المنتج')}</legend>
        {(['available', 'unavailable'] as const).map((value) => (
          <label
            key={value}
            className={'builder-availability-choice' + (availability === value ? ' selected' : '')}
          >
            <input
              type="radio"
              name="availability"
              checked={availability === value}
              onChange={() => onAvailabilityChange(value)}
            />
            <span>
              <strong>
                {value === 'available'
                  ? text('Publish and make available', 'نشر وإتاحة للبيع')
                  : text('Save as unavailable', 'حفظ كغير متاح')}
              </strong>
              <small>
                {value === 'available'
                  ? text(
                      'Customers can order this product once it is created.',
                      'يمكن للعملاء طلب المنتج بعد إنشائه.',
                    )
                  : text(
                      'Keep it in the catalog without accepting orders.',
                      'احتفظ به في الكتالوج دون قبول الطلبات.',
                    )}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
