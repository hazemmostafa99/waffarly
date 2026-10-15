export function BasicInformationTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  basePrice,
  onBasePriceChange,
  text,
}: {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  basePrice: string;
  onBasePriceChange: (value: string) => void;
  text: (english: string, arabic: string) => string;
}) {
  return (
    <div className="builder-fields">
      <div className="builder-section-heading">
        <span>{text('01', '01')}</span>
        <div>
          <h2>{text('Basic information', 'المعلومات الأساسية')}</h2>
          <p>
            {text(
              'Set the product base price. When variants are added, each variant price is used for quotes instead.',
              'أدخل الاسم والسعر الأساسي الذي سيظهر للعملاء.',
            )}
          </p>
        </div>
      </div>
      <label className="builder-field">
        <span>
          {text('Product name', 'اسم المنتج')} <i>*</i>
        </span>
        <input
          required
          maxLength={160}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={text('e.g. Classic burger', 'مثال: برجر كلاسيك')}
        />
      </label>
      <label className="builder-field">
        <span>{text('Description', 'الوصف')}</span>
        <textarea
          rows={4}
          maxLength={1000}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={text(
            'Describe the ingredients or what makes it special.',
            'اكتب وصفاً للمكونات أو ما يميز المنتج.',
          )}
        />
        <small>
          {text(String(description.length), String(description.length))}/{text('1000', '1000')}
        </small>
      </label>
      <div className="builder-field-row">
        <label className="builder-field">
          <span>
            {text('Base price', 'السعر الأساسي')} <i>*</i>
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
        </label>
        <div className="builder-field">
          <span>{text('Selling unit', 'وحدة البيع')}</span>
          <div className="builder-fixed-value">
            <span>◉</span>
            {text('Piece', 'قطعة')}
            <small>
              {text('Only unit available in this version', 'وحدة البيع المتاحة حالياً')}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
