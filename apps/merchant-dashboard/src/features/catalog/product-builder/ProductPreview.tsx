import { activityChoicePhrases, type ActivityWording } from '@waffarly/contracts';
import { CustomerChoicesPreview } from './CustomerChoicesPreview.js';
import { Icon } from '../../../Icons.js';
import type { GroupDraft, VariantDraft } from './product-builder.types.js';
import { productPreviewPrice } from './product-promotion-preview.js';

export function ProductPreview({
  wording,
  name,
  description,
  basePrice,
  promotionEnabled,
  promotionType,
  promotionValue,
  image,
  categoryName,
  groups,
  variants,
  formatNumber,
  text,
}: {
  wording: ActivityWording;
  name: string;
  description: string;
  basePrice: string;
  promotionEnabled: boolean;
  promotionType: 'percentage' | 'amount';
  promotionValue: string;
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
    .map(
      (variant) =>
        productPreviewPrice(variant.price, promotionEnabled, promotionType, promotionValue) ??
        Number(variant.price),
    )
    .filter((price) => Number.isFinite(price) && price > 0);
  const validBasePrice =
    /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(basePrice) && Number(basePrice) > 0;
  const discountedBasePrice = productPreviewPrice(
    basePrice,
    promotionEnabled,
    promotionType,
    promotionValue,
  );
  const originalStartingPrice = variants.length
    ? (pricedVariants.map((variant) => Number(variant.price)).sort((a, b) => a - b)[0] ?? 0)
    : Number(basePrice);
  const hasDiscountedPrice = variants.length
    ? pricedVariants.some(
        (variant) =>
          productPreviewPrice(variant.price, promotionEnabled, promotionType, promotionValue) !==
          null,
      )
    : discountedBasePrice !== null;
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
                {text(
                  activityChoicePhrases(wording).enterPrices.en,
                  activityChoicePhrases(wording).enterPrices.ar,
                )}
              </span>
            )
          ) : validBasePrice ? (
            <>
              EGP{' '}
              {formatNumber(discountedBasePrice ?? Number(basePrice), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </>
          ) : (
            <span className="preview-price-empty">{text('Enter a price', 'أدخل السعر')}</span>
          )}
        </strong>
        {hasDiscountedPrice &&
          originalStartingPrice > 0 &&
          (variants.length ? variantPrices.length > 0 : validBasePrice) && (
            <del className="preview-original-price">
              EGP{' '}
              {formatNumber(originalStartingPrice, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </del>
          )}
      </div>
      <CustomerChoicesPreview
        wording={wording}
        groups={groups}
        variants={variants}
        basePrice={basePrice}
        promotionEnabled={promotionEnabled}
        promotionType={promotionType}
        promotionValue={promotionValue}
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
