import { useState } from 'react';

export function BasicInformationTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  basePrice,
  onBasePriceChange,
  productMode,
  text,
}: {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  basePrice: string;
  onBasePriceChange: (value: string) => void;
  productMode: 'simple' | 'variants';
  text: (english: string, arabic: string) => string;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(Boolean(description));
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
            placeholder={text('e.g. Classic burger', 'مثال: برجر كلاسيك')}
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
          {productMode === 'variants' && (
            <small>
              {text(
                'Required for the catalog. Each size uses its own price when available.',
                'مطلوب للكتالوج. يظهر سعر كل حجم بدلًا منه عند اختيار الأحجام.',
              )}
            </small>
          )}
        </label>
      </div>
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
            placeholder={text(
              'Describe the ingredients or what makes it special.',
              'اكتب وصفًا للمكونات أو ما يميز المنتج.',
            )}
          />
          <small>{text(String(description.length), String(description.length) + '/1000')}</small>
        </div>
      </details>
    </div>
  );
}
