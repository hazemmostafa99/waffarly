import { Icon } from '../../../Icons.js';
import type { GroupDraft, VariantDraft } from './product-builder.types.js';

export function ProductPreview({
  name,
  description,
  basePrice,
  image,
  categoryName,
  groups,
  variants,
  total,
  formatNumber,
  text,
}: {
  name: string;
  description: string;
  basePrice: string;
  image?: string | undefined;
  categoryName?: string | undefined;
  groups: GroupDraft[];
  variants: VariantDraft[];
  total: number;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  text: (english: string, arabic: string) => string;
}) {
  return (
    <aside className="product-preview-card" aria-label={text('Product preview', 'معاينة المنتج')}>
      <div className="preview-card-heading">
        <span>{text('Live preview', 'معاينة مباشرة')}</span>
        <Icon name="eye" />
      </div>
      <div className="preview-image-wrap">
        {image ? (
          <img src={image} alt="" />
        ) : (
          <div className="preview-image-empty">
            <Icon name="image" />
            <span>{text('Product image', 'صورة المنتج')}</span>
          </div>
        )}
        {categoryName && <span className="preview-category">{categoryName}</span>}
      </div>
      <div className="preview-copy">
        <h2>{name || text('Your product name', 'اسم المنتج')}</h2>
        <p>
          {description ||
            text('Your product description will appear here.', 'سيظهر وصف المنتج هنا.')}
        </p>
        <strong className="preview-base-price">
          {variants.length ? text('From ', 'ابتداءً من ') : ''}EGP{' '}
          {variants.length
            ? formatNumber(Math.min(...variants.map((variant) => Number(variant.price || 0))), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : formatNumber(Number(basePrice || 0), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
        </strong>
      </div>
      {!!variants.length && (
        <div className="preview-selected-options">
          <h3>{text('Variants', 'المتغيرات')}</h3>
          {variants.map((variant) => (
            <div className="preview-option-row" key={variant.id}>
              <span>{variant.name || text('Variant', 'متغير')}</span>
              <span dir="ltr">
                EGP{' '}
                {formatNumber(Number(variant.price || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          ))}
        </div>
      )}
      {!!groups.length && (
        <div className="preview-selected-options">
          <h3>{text('Options', 'الخيارات')}</h3>
          {groups.map((group) => (
            <div className="preview-option-row" key={group.id}>
              <span>{group.name || text('Option group', 'مجموعة خيارات')}</span>
              <span>
                {group.options
                  .filter((option) => option.defaultSelected)
                  .map((option) => option.name || text('Choice', 'اختيار'))
                  .join('، ') ||
                  (group.minSelections
                    ? text('Customer choice required', 'يتطلب اختيار العميل')
                    : text('Optional', 'اختياري'))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="preview-total">
        <span>{text('Starting total', 'الإجمالي المبدئي')}</span>
        <strong dir="ltr">
          EGP {formatNumber(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      </div>
      <p className="preview-note">
        {text(
          'Price includes the selected defaults; customer choices may change it.',
          'يشمل السعر الاختيارات الافتراضية وقد يتغير حسب اختيارات العميل.',
        )}
      </p>
    </aside>
  );
}
