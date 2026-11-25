import { useState } from 'react';
import type { ActivityWording } from '@waffarly/contracts';
import { ProductPromotionFields } from './ProductPromotionFields.js';

export function BasicInformationTab({
  wording,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  basePrice,
  onBasePriceChange,
  productMode,
  promotionEnabled,
  onPromotionEnabledChange,
  promotionType,
  onPromotionTypeChange,
  promotionValue,
  onPromotionValueChange,
  promotionStartsAt,
  onPromotionStartsAtChange,
  promotionEndsAt,
  onPromotionEndsAtChange,
  previewPrices,
  formatNumber,
  text,
}: {
  wording: ActivityWording;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  basePrice: string;
  onBasePriceChange: (value: string) => void;
  productMode: 'simple' | 'variants';
  promotionEnabled: boolean;
  onPromotionEnabledChange: (value: boolean) => void;
  promotionType: 'percentage' | 'amount';
  onPromotionTypeChange: (value: 'percentage' | 'amount') => void;
  promotionValue: string;
  onPromotionValueChange: (value: string) => void;
  promotionStartsAt: string;
  onPromotionStartsAtChange: (value: string) => void;
  promotionEndsAt: string;
  onPromotionEndsAtChange: (value: string) => void;
  previewPrices: string[];
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  text: (english: string, arabic: string) => string;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(Boolean(description));
  const say = (words: { en: string; ar: string }) => text(words.en, words.ar);
  return (
    <div className="builder-fields basic-information-fields">
      <div className="basic-name-price-row">
        <label className="builder-field basic-product-name">
          <span>
            {text('Product name', 'اسم المنتج')} <i>*</i>
          </span>
          <input
            required
            autoFocus
            maxLength={160}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={say(wording.product.nameExample)}
          />
          <small>
            {text(
              'Use a short, familiar name customers can find easily.',
              'استخدم اسمًا واضحًا يسهل على العملاء العثور عليه.',
            )}
          </small>
        </label>
        <label className="builder-field">
          <span>
            {productMode === 'variants'
              ? text('Base price', 'السعر الأساسي')
              : text('Selling price', 'سعر البيع')}{' '}
            <i>*</i>
          </span>
          <div className="builder-currency-field">
            <input
              required
              type="number"
              lang="en"
              dir="ltr"
              inputMode="decimal"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              value={basePrice}
              onChange={(event) => onBasePriceChange(event.target.value)}
              placeholder="0.00"
            />
            <b>EGP</b>
          </div>
          {productMode === 'variants' && <small>{say(wording.product.choicePriceHint)}</small>}
        </label>
      </div>
      <ProductPromotionFields
        enabled={promotionEnabled}
        onEnabledChange={onPromotionEnabledChange}
        type={promotionType}
        onTypeChange={onPromotionTypeChange}
        value={promotionValue}
        onValueChange={onPromotionValueChange}
        startsAt={promotionStartsAt}
        onStartsAtChange={onPromotionStartsAtChange}
        endsAt={promotionEndsAt}
        onEndsAtChange={onPromotionEndsAtChange}
        previewPrices={previewPrices}
        formatNumber={formatNumber}
        text={text}
      />
      <details
        className="basic-description"
        open={descriptionOpen}
        onToggle={(event) => setDescriptionOpen(event.currentTarget.open)}
      >
        <summary>
          {text('Add a description', 'إضافة وصف')}
          <span>{description ? text('Added', 'تمت الإضافة') : text('Optional', 'اختياري')}</span>
        </summary>
        <div className="builder-field">
          <span>{text('Description', 'الوصف')}</span>
          <textarea
            rows={4}
            maxLength={1000}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={say(wording.product.descriptionHint)}
          />
          <small>{text(String(description.length), String(description.length) + '/1000')}</small>
        </div>
      </details>
    </div>
  );
}
