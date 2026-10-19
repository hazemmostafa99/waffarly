import { CustomerChoicesPreview } from './CustomerChoicesPreview.js';
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
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  text: (english: string, arabic: string) => string;
}) {
  const availableVariants = variants.filter((variant) => variant.availability === 'available');
  const pricedVariants = availableVariants.length ? availableVariants : variants;
  const variantPrices = pricedVariants
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  const validBasePrice =
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(basePrice) && Number(basePrice) > 0;
  return (
    <aside className="product-preview-card" aria-label={text('Product preview', 'معاينة المنتج')}>
      <div className="preview-card-heading">
        <span>{text('Customer preview', 'معاينة العميل')}</span>
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
          {variants.length ? (
            variantPrices.length ? (
              <>
                {text('From ', 'ابتداءً من ')}EGP{' '}
                {formatNumber(Math.min(...variantPrices), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </>
            ) : (
              <span className="preview-price-empty">
                {text('Enter variant prices', 'أدخل أسعار الأحجام')}
              </span>
            )
          ) : validBasePrice ? (
            <>
              EGP{' '}
              {formatNumber(Number(basePrice), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </>
          ) : (
            <span className="preview-price-empty">{text('Enter a price', 'أدخل السعر')}</span>
          )}
        </strong>
      </div>
      <CustomerChoicesPreview
        groups={groups}
        variants={variants}
        basePrice={basePrice}
        text={text}
      />
      <p className="preview-note">
        {text(
          'Try the choices and prices before saving your product.',
          'جرّب الاختيارات والأسعار قبل حفظ المنتج.',
        )}
      </p>
    </aside>
  );
}
