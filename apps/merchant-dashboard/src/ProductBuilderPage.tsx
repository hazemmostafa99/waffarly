import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import type {
  CatalogCategorySummary,
  CatalogMediaAsset,
  CatalogProductModifierGroupFields,
  CatalogProductSummary,
} from '@waffarly/contracts';
import { Icon } from './Icons.js';
import { apiRequest, apiUpload } from './lib/api-client.js';

type OptionDraft = {
  id: string;
  name: string;
  priceAdjustment: string;
  defaultSelected: boolean;
};

type GroupDraft = {
  id: string;
  name: string;
  description: string;
  selectionMode: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  options: OptionDraft[];
};

const tabKeys = ['basic', 'details', 'options', 'preview'] as const;

function newId() {
  return crypto.randomUUID();
}

export function ProductBuilderPage() {
  const { locale, errorText } = useLocale();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const { id: productId } = useParams<{ id: string }>();
  const isEditing = Boolean(productId);
  const text = (english: string, arabic: string) => (isArabic ? arabic : english);
  const [activeTab, setActiveTab] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [availability, setAvailability] = useState<'available' | 'unavailable'>('available');
  const [categories, setCategories] = useState<CatalogCategorySummary[]>([]);
  const [media, setMedia] = useState<CatalogMediaAsset[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [imageAssetIds, setImageAssetIds] = useState<string[]>([]);
  const [primaryImageAssetId, setPrimaryImageAssetId] = useState('');
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(Boolean(productId));
  const [notFound, setNotFound] = useState(false);
  const [revision, setRevision] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      apiRequest<CatalogCategorySummary[]>('/owner/catalog/categories'),
      apiRequest<CatalogMediaAsset[]>('/owner/catalog/media'),
    ])
      .then(([nextCategories, nextMedia]) => {
        setCategories(nextCategories.filter((category) => !category.archivedAt));
        setMedia(nextMedia);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : text('Could not load catalog data.', 'تعذر تحميل بيانات الكتالوج.'),
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setNotFound(false);
    setError('');
    setActiveTab(0);
    setRevision(null);

    if (!productId) {
      setProductLoading(false);
      setName('');
      setDescription('');
      setBasePrice('');
      setAvailability('available');
      setCategoryIds([]);
      setImageAssetIds([]);
      setPrimaryImageAssetId('');
      setGroups([]);
      return () => {
        cancelled = true;
      };
    }

    setProductLoading(true);
    void apiRequest<CatalogProductSummary[]>('/owner/catalog/products')
      .then((products) => {
        if (cancelled) return;
        const product = products.find((item) => item.id === productId);
        if (!product) {
          setNotFound(true);
          return;
        }

        const productImages = [...product.images].sort((a, b) => a.position - b.position);
        setName(product.name);
        setDescription(product.description ?? '');
        setBasePrice(product.basePrice);
        setAvailability(product.availability);
        setCategoryIds(product.categories.map((category) => category.id));
        setImageAssetIds(productImages.map((image) => image.mediaAssetId));
        setPrimaryImageAssetId(
          productImages.find((image) => image.isPrimary)?.mediaAssetId ??
            productImages[0]?.mediaAssetId ??
            '',
        );
        setGroups(
          [...product.modifierGroups]
            .sort((a, b) => a.position - b.position)
            .map((group) => ({
              id: group.id,
              name: group.name,
              description: group.description ?? '',
              selectionMode: group.selectionMode,
              minSelections: group.minSelections,
              maxSelections: group.maxSelections,
              options: [...group.options]
                .sort((a, b) => a.position - b.position)
                .map((option) => ({
                  id: option.id,
                  name: option.name,
                  priceAdjustment: option.priceAdjustment,
                  defaultSelected: option.defaultSelected,
                })),
            })),
        );
        setRevision(product.revision);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load product.');
        }
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const selectedImages = useMemo(
    () => imageAssetIds.map((id) => media.find((asset) => asset.id === id)).filter(Boolean),
    [imageAssetIds, media],
  );
  const primaryImage =
    media.find((asset) => asset.id === primaryImageAssetId && imageAssetIds.includes(asset.id)) ??
    selectedImages[0];
  const selectedCategories = categories.filter((category) => categoryIds.includes(category.id));
  const defaultAdjustment = groups.reduce(
    (sum, group) =>
      sum +
      group.options.reduce(
        (optionSum, option) =>
          optionSum + (option.defaultSelected ? Number(option.priceAdjustment || 0) : 0),
        0,
      ),
    0,
  );

  async function uploadImage(file: File) {
    setError('');
    if (
      file.size <= 0 ||
      file.size > 10 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ) {
      setError(
        text(
          'Choose a JPEG, PNG, or WebP image up to 10 MB.',
          'اختر صورة JPEG أو PNG أو WebP بحجم لا يتجاوز 10 ميجابايت.',
        ),
      );
      return;
    }
    if (imageAssetIds.length >= 10) {
      setError(text('A product can have up to 10 images.', 'يمكن إضافة 10 صور كحد أقصى للمنتج.'));
      return;
    }
    setUploading(true);
    try {
      const asset = await apiUpload<CatalogMediaAsset>('/owner/catalog/media/upload', file);
      setMedia((current) => [asset, ...current]);
      setImageAssetIds((current) => [...current, asset.id]);
      setPrimaryImageAssetId((current) => current || asset.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : text('Could not upload image.', 'تعذر رفع الصورة.'),
      );
    } finally {
      setUploading(false);
    }
  }

  function validateStep(step: number): boolean {
    if (step === 0) {
      if (!name.trim()) {
        setError(text('Enter a product name.', 'أدخل اسم المنتج.'));
        return false;
      }
      if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(basePrice) || Number(basePrice) <= 0) {
        setError(
          text('Enter a valid base price in EGP.', 'أدخل سعراً أساسياً صحيحاً بالجنيه المصري.'),
        );
        return false;
      }
    }
    if (step === 1) {
      if (!categoryIds.length) {
        setError(text('Choose at least one category.', 'اختر تصنيفاً واحداً على الأقل.'));
        return false;
      }
      if (!imageAssetIds.length) {
        setError(text('Add at least one product image.', 'أضف صورة واحدة على الأقل للمنتج.'));
        return false;
      }
    }
    if (step === 2) {
      const invalidGroup = groups.find((group) => {
        const defaults = group.options.filter((option) => option.defaultSelected).length;
        return (
          !group.name.trim() ||
          group.options.length === 0 ||
          group.options.some(
            (option) =>
              !option.name.trim() ||
              !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(option.priceAdjustment) ||
              Number(option.priceAdjustment) < 0,
          ) ||
          !Number.isInteger(group.minSelections) ||
          !Number.isInteger(group.maxSelections) ||
          group.minSelections < 0 ||
          group.maxSelections < 1 ||
          group.minSelections > group.maxSelections ||
          group.maxSelections > group.options.length ||
          (group.selectionMode === 'single' && group.maxSelections !== 1) ||
          defaults > group.maxSelections
        );
      });
      if (invalidGroup) {
        setError(
          text(
            'Check each option group: add names and options, and keep the selection limits valid.',
            'راجع كل مجموعة خيارات: أضف الأسماء والخيارات وتأكد من صحة حدود الاختيار.',
          ),
        );
        return false;
      }
    }
    setError('');
    return true;
  }

  function changeGroup(groupId: string, update: Partial<GroupDraft>) {
    setGroups((current) =>
      current.map((group) => (group.id === groupId ? { ...group, ...update } : group)),
    );
  }

  function changeOption(groupId: string, optionId: string, update: Partial<OptionDraft>) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              options: group.options.map((option) =>
                option.id === optionId ? { ...option, ...update } : option,
              ),
            }
          : group,
      ),
    );
  }

  function addGroup() {
    setGroups((current) => [
      ...current,
      {
        id: newId(),
        name: '',
        description: '',
        selectionMode: 'single',
        minSelections: 0,
        maxSelections: 1,
        options: [{ id: newId(), name: '', priceAdjustment: '0', defaultSelected: false }],
      },
    ]);
  }

  function addOption(group: GroupDraft) {
    const options = [
      ...group.options,
      { id: newId(), name: '', priceAdjustment: '0', defaultSelected: false },
    ];
    changeGroup(group.id, {
      options,
      maxSelections:
        group.selectionMode === 'single' ? 1 : Math.max(group.maxSelections, options.length),
    });
  }

  function moveGroup(index: number, direction: -1 | 1) {
    setGroups((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function moveOption(group: GroupDraft, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= group.options.length) return;
    const options = [...group.options];
    [options[index], options[target]] = [options[target]!, options[index]!];
    changeGroup(group.id, { options });
  }

  function removeOption(group: GroupDraft, optionId: string) {
    const options = group.options.filter((option) => option.id !== optionId);
    changeGroup(group.id, {
      options,
      minSelections: Math.min(group.minSelections, options.length),
      maxSelections: Math.max(1, Math.min(group.maxSelections, options.length)),
    });
  }

  async function submitProduct() {
    if (isEditing && revision === null) {
      setError(text('The product is not ready to save.', 'المنتج غير جاهز للحفظ.'));
      return;
    }
    for (let step = 0; step <= 2; step += 1) {
      if (!validateStep(step)) {
        setActiveTab(step);
        return;
      }
    }
    setSubmitting(true);
    setError('');
    const modifierGroups: CatalogProductModifierGroupFields[] = groups.map(
      (group, groupPosition) => ({
        name: group.name.trim(),
        description: group.description.trim() || undefined,
        selectionMode: group.selectionMode,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        position: groupPosition,
        options: group.options.map((option, position) => ({
          name: option.name.trim(),
          priceAdjustment: Number(option.priceAdjustment).toFixed(2),
          defaultSelected: option.defaultSelected,
          position,
        })),
      }),
    );
    try {
      await apiRequest<CatalogProductSummary>(
        productId ? `/owner/catalog/products/${productId}` : '/owner/catalog/products',
        {
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...(isEditing ? { revision } : {}),
            name: name.trim(),
            description: description.trim(),
            basePrice: Number(basePrice).toFixed(2),
            availability,
            imageAssetIds,
            primaryImageAssetId: imageAssetIds.includes(primaryImageAssetId)
              ? primaryImageAssetId
              : imageAssetIds[0],
            categoryIds,
            modifierGroups,
          }),
        },
      );
      navigate('/products', { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : text('Could not save product.', 'تعذر حفظ المنتج.'),
      );
      setActiveTab(3);
    } finally {
      setSubmitting(false);
    }
  }

  const tabs = [
    text('Basic information', 'المعلومات الأساسية'),
    text('Product details', 'تفاصيل المنتج'),
    text('Options', 'الخيارات'),
    text('Preview and publish', 'المعاينة والنشر'),
  ];

  return (
    <div className="product-builder-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="product-builder-topbar">
        <div>
          <nav
            className="product-builder-breadcrumb"
            aria-label={text('Breadcrumb', 'مسار التنقل')}
          >
            <Link to="/products">{text('Products', 'المنتجات')}</Link>
            <span>/</span>
            <span>
              {isEditing ? text('Edit product', 'تعديل المنتج') : text('New product', 'منتج جديد')}
            </span>
          </nav>
          <h1>
            {isEditing
              ? text('Edit product', 'تعديل المنتج')
              : text('Create a product', 'إضافة منتج')}
          </h1>
          <p>
            {isEditing
              ? text(
                  'Update the product details, choices, and catalog preview.',
                  'حدّث تفاصيل المنتج وخياراته ومعاينته في الكتالوج.',
                )
              : text(
                  'Add the product, its choices, then review how it will appear in your catalog.',
                  'أضف المنتج وخياراته، ثم راجع طريقة ظهوره في الكتالوج.',
                )}
          </p>
        </div>
        <Link className="builder-button ghost" to="/products">
          {text('Cancel', 'إلغاء')}
        </Link>
      </header>

      <div
        className="builder-steps"
        role="tablist"
        aria-label={text('Product setup sections', 'أقسام إعداد المنتج')}
      >
        {tabs.map((label, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === index}
            aria-controls={`product-builder-panel-${tabKeys[index]}`}
            id={`product-builder-tab-${tabKeys[index]}`}
            className={`builder-step ${activeTab === index ? 'active' : index < activeTab ? 'done' : ''}`}
            key={tabKeys[index]}
            onClick={() => {
              setError('');
              setActiveTab(index);
            }}
          >
            <span>{index < activeTab ? '✓' : index + 1}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </div>

      {error && (
        <p className="builder-error" role="alert">
          {errorText(error)}
        </p>
      )}
      {loading || productLoading ? (
        <section className="builder-panel" role="status">
          {isEditing
            ? text('Loading product…', 'جارٍ تحميل المنتج…')
            : text('Loading categories and media…', 'جارٍ تحميل التصنيفات والوسائط…')}
        </section>
      ) : notFound ? (
        <section className="builder-panel" role="status">
          <p>{text('This product could not be found.', 'تعذّر العثور على هذا المنتج.')}</p>
          <Link className="builder-button ghost" to="/products">
            {text('Back to products', 'العودة إلى المنتجات')}
          </Link>
        </section>
      ) : (
        <div className="builder-columns">
          <main className="builder-main">
            <section
              className="builder-panel"
              id={`product-builder-panel-${tabKeys[activeTab]}`}
              role="tabpanel"
              aria-labelledby={`product-builder-tab-${tabKeys[activeTab]}`}
            >
              {activeTab === 0 && (
                <BasicInformationTab
                  name={name}
                  onNameChange={setName}
                  description={description}
                  onDescriptionChange={setDescription}
                  basePrice={basePrice}
                  onBasePriceChange={setBasePrice}
                  text={text}
                />
              )}
              {activeTab === 1 && (
                <ProductDetailsTab
                  categories={categories}
                  categoryIds={categoryIds}
                  onCategoryIdsChange={setCategoryIds}
                  media={media}
                  imageAssetIds={imageAssetIds}
                  primaryImageAssetId={primaryImageAssetId}
                  onImageIdsChange={(ids) => {
                    setImageAssetIds(ids);
                    if (!ids.includes(primaryImageAssetId)) setPrimaryImageAssetId(ids[0] ?? '');
                  }}
                  onPrimaryImageChange={setPrimaryImageAssetId}
                  onUpload={uploadImage}
                  uploading={uploading}
                  text={text}
                />
              )}
              {activeTab === 2 && (
                <OptionsTab
                  groups={groups}
                  onGroupsChange={setGroups}
                  onGroupChange={changeGroup}
                  onOptionChange={changeOption}
                  onAddGroup={addGroup}
                  onAddOption={addOption}
                  onRemoveOption={removeOption}
                  onMoveGroup={moveGroup}
                  onMoveOption={moveOption}
                  text={text}
                />
              )}
              {activeTab === 3 && (
                <PreviewPublishTab
                  name={name}
                  description={description}
                  basePrice={basePrice}
                  availability={availability}
                  onAvailabilityChange={setAvailability}
                  categories={selectedCategories}
                  images={selectedImages.filter((asset): asset is CatalogMediaAsset =>
                    Boolean(asset),
                  )}
                  groups={groups}
                  text={text}
                />
              )}
              <footer className="builder-navigation">
                <button
                  type="button"
                  className="builder-button ghost"
                  disabled={activeTab === 0 || submitting}
                  onClick={() => {
                    setError('');
                    setActiveTab((current) => Math.max(0, current - 1));
                  }}
                >
                  {text('Back', 'السابق')}
                </button>
                {activeTab < 3 ? (
                  <button
                    type="button"
                    className="builder-button primary"
                    disabled={uploading}
                    onClick={() =>
                      validateStep(activeTab) && setActiveTab((current) => Math.min(3, current + 1))
                    }
                  >
                    {text('Continue', 'متابعة')}
                    <span aria-hidden="true">{isArabic ? '←' : '→'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="builder-button primary"
                    disabled={submitting || uploading}
                    onClick={() => void submitProduct()}
                  >
                    <Icon name="check" />
                    {submitting
                      ? text('Saving…', 'جارٍ الحفظ…')
                      : isEditing
                        ? text('Save changes', 'حفظ التغييرات')
                        : availability === 'available'
                          ? text('Create and publish', 'إنشاء ونشر')
                          : text('Create as unavailable', 'إنشاء كغير متاح')}
                  </button>
                )}
              </footer>
            </section>
            {categories.length === 0 && !loading && (
              <p className="builder-hint">
                {text('Create a category before adding a product.', 'أنشئ تصنيفاً قبل إضافة منتج.')}{' '}
                <Link to="/categories">{text('Go to categories', 'الانتقال إلى التصنيفات')}</Link>
              </p>
            )}
          </main>
          <ProductPreview
            name={name}
            description={description}
            basePrice={basePrice}
            image={primaryImage?.publicUrl}
            categoryName={selectedCategories[0]?.name}
            groups={groups}
            total={Number(basePrice || 0) + defaultAdjustment}
            text={text}
          />
        </div>
      )}
    </div>
  );
}

function BasicInformationTab({
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
        <span>01</span>
        <div>
          <h2>{text('Basic information', 'المعلومات الأساسية')}</h2>
          <p>
            {text(
              'Set the name and base price customers will see.',
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
        <small>{description.length}/1000</small>
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

function ProductDetailsTab({
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
        <span>02</span>
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

function OptionsTab({
  groups,
  onGroupsChange,
  onGroupChange,
  onOptionChange,
  onAddGroup,
  onAddOption,
  onRemoveOption,
  onMoveGroup,
  onMoveOption,
  text,
}: {
  groups: GroupDraft[];
  onGroupsChange: (groups: GroupDraft[]) => void;
  onGroupChange: (id: string, update: Partial<GroupDraft>) => void;
  onOptionChange: (groupId: string, optionId: string, update: Partial<OptionDraft>) => void;
  onAddGroup: () => void;
  onAddOption: (group: GroupDraft) => void;
  onRemoveOption: (group: GroupDraft, optionId: string) => void;
  onMoveGroup: (index: number, direction: -1 | 1) => void;
  onMoveOption: (group: GroupDraft, index: number, direction: -1 | 1) => void;
  text: (english: string, arabic: string) => string;
}) {
  return (
    <div className="builder-fields">
      <div className="builder-section-heading builder-heading-action">
        <span>03</span>
        <div>
          <h2>{text('Options', 'الخيارات')}</h2>
          <p>
            {text(
              'Create product-specific choices with fixed EGP price adjustments.',
              'أنشئ خيارات خاصة بالمنتج مع فروق سعر ثابتة بالجنيه المصري.',
            )}
          </p>
        </div>
        <button type="button" className="builder-button primary" onClick={onAddGroup}>
          <Icon name="plus" />
          {text('Add group', 'إضافة مجموعة')}
        </button>
      </div>
      <div className="builder-info-banner">
        <span>i</span>
        <p>
          {text(
            'Groups are single or multiple choice. Set the minimum and maximum number a customer may choose. A minimum of 0 means optional.',
            'تكون المجموعة باختيار واحد أو عدة اختيارات. حدد أقل وأكبر عدد يمكن للعميل اختياره. الحد الأدنى 0 يعني أن المجموعة اختيارية.',
          )}
        </p>
      </div>
      {!groups.length && (
        <div className="builder-empty-state builder-empty-options">
          <strong>{text('No option groups added', 'لم تتم إضافة مجموعات خيارات')}</strong>
          <p>
            {text(
              'Add a group for sizes, add-ons, sauces, or other choices.',
              'أضف مجموعة للأحجام أو الإضافات أو الصلصات أو غيرها.',
            )}
          </p>
          <button type="button" className="builder-button" onClick={onAddGroup}>
            {text('Add first group', 'إضافة أول مجموعة')}
          </button>
        </div>
      )}
      <div className="builder-groups-list">
        {groups.map((group, groupIndex) => (
          <section className="builder-group-card" key={group.id}>
            <header className="builder-group-header">
              <div className="builder-order-buttons">
                <button
                  type="button"
                  aria-label={text('Move group up', 'تحريك المجموعة لأعلى')}
                  disabled={groupIndex === 0}
                  onClick={() => onMoveGroup(groupIndex, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={text('Move group down', 'تحريك المجموعة لأسفل')}
                  disabled={groupIndex === groups.length - 1}
                  onClick={() => onMoveGroup(groupIndex, 1)}
                >
                  ↓
                </button>
              </div>
              <span className="builder-group-index">{groupIndex + 1}</span>
              <div>
                <strong>{group.name || text('New option group', 'مجموعة خيارات جديدة')}</strong>
                <small>
                  {group.minSelections === 0
                    ? text('Optional', 'اختيارية')
                    : text('Required', 'مطلوبة')}
                </small>
              </div>
              <button
                type="button"
                className="builder-remove-button"
                aria-label={text('Remove group', 'حذف المجموعة')}
                onClick={() => onGroupsChange(groups.filter((item) => item.id !== group.id))}
              >
                ×
              </button>
            </header>
            <div className="builder-group-fields">
              <label className="builder-field">
                <span>
                  {text('Group name', 'اسم المجموعة')} <i>*</i>
                </span>
                <input
                  maxLength={160}
                  value={group.name}
                  onChange={(event) => onGroupChange(group.id, { name: event.target.value })}
                  placeholder={text('e.g. Choose a size', 'مثال: اختر الحجم')}
                />
              </label>
              <label className="builder-field">
                <span>{text('Customer instructions', 'تعليمات للعميل')}</span>
                <input
                  maxLength={1000}
                  value={group.description}
                  onChange={(event) => onGroupChange(group.id, { description: event.target.value })}
                  placeholder={text('Optional short description', 'وصف مختصر اختياري')}
                />
              </label>
              <label className="builder-field">
                <span>{text('Choice type', 'نوع الاختيار')}</span>
                <select
                  value={group.selectionMode}
                  onChange={(event) => {
                    const selectionMode = event.target.value as GroupDraft['selectionMode'];
                    onGroupChange(group.id, {
                      selectionMode,
                      minSelections:
                        selectionMode === 'single'
                          ? Math.min(group.minSelections, 1)
                          : group.minSelections,
                      maxSelections:
                        selectionMode === 'single'
                          ? 1
                          : Math.min(group.options.length, Math.max(2, group.maxSelections)),
                    });
                  }}
                >
                  <option value="single">{text('Single choice', 'اختيار واحد')}</option>
                  <option value="multiple">{text('Multiple choice', 'اختيارات متعددة')}</option>
                </select>
              </label>
              <div className="builder-selection-limits">
                <label className="builder-field">
                  <span>{text('Minimum selections', 'أقل عدد للاختيارات')}</span>
                  <input
                    type="number"
                    min="0"
                    max={group.options.length}
                    value={group.minSelections}
                    onChange={(event) =>
                      onGroupChange(group.id, { minSelections: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="builder-field">
                  <span>{text('Maximum selections', 'أكبر عدد للاختيارات')}</span>
                  <input
                    type="number"
                    min="1"
                    max={group.options.length}
                    disabled={group.selectionMode === 'single'}
                    value={group.maxSelections}
                    onChange={(event) =>
                      onGroupChange(group.id, { maxSelections: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="builder-options-heading">
              <strong>{text('Choices', 'الاختيارات')}</strong>
              <span>{text('EGP price adjustment', 'فرق السعر بالجنيه')}</span>
              <span>{text('Default', 'افتراضي')}</span>
            </div>
            <div className="builder-option-list">
              {group.options.map((option, optionIndex) => (
                <div className="builder-option-row" key={option.id}>
                  <div className="builder-order-buttons">
                    <button
                      type="button"
                      aria-label={text('Move choice up', 'تحريك الاختيار لأعلى')}
                      disabled={optionIndex === 0}
                      onClick={() => onMoveOption(group, optionIndex, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={text('Move choice down', 'تحريك الاختيار لأسفل')}
                      disabled={optionIndex === group.options.length - 1}
                      onClick={() => onMoveOption(group, optionIndex, 1)}
                    >
                      ↓
                    </button>
                  </div>
                  <input
                    aria-label={text('Choice name', 'اسم الاختيار')}
                    maxLength={160}
                    value={option.name}
                    onChange={(event) =>
                      onOptionChange(group.id, option.id, { name: event.target.value })
                    }
                    placeholder={text('e.g. Large', 'مثال: كبير')}
                  />
                  <div className="builder-currency-field">
                    <input
                      aria-label={text('Price adjustment in EGP', 'فرق السعر بالجنيه')}
                      type="number"
                      min="0"
                      step="0.01"
                      value={option.priceAdjustment}
                      onChange={(event) =>
                        onOptionChange(group.id, option.id, { priceAdjustment: event.target.value })
                      }
                    />
                    <b>EGP</b>
                  </div>
                  <label className="builder-default-choice">
                    <input
                      type={group.selectionMode === 'single' ? 'radio' : 'checkbox'}
                      name={`default-${group.id}`}
                      checked={option.defaultSelected}
                      onChange={(event) => {
                        if (group.selectionMode === 'single') {
                          onGroupChange(group.id, {
                            options: group.options.map((item) => ({
                              ...item,
                              defaultSelected: item.id === option.id,
                            })),
                          });
                        } else
                          onOptionChange(group.id, option.id, {
                            defaultSelected: event.target.checked,
                          });
                      }}
                    />
                    <span>{option.defaultSelected ? text('Yes', 'نعم') : text('No', 'لا')}</span>
                  </label>
                  <button
                    type="button"
                    className="builder-remove-button"
                    aria-label={text('Remove choice', 'حذف الاختيار')}
                    disabled={group.options.length === 1}
                    onClick={() => onRemoveOption(group, option.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="builder-add-choice" onClick={() => onAddOption(group)}>
              <Icon name="plus" />
              {text('Add choice', 'إضافة اختيار')}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}

function PreviewPublishTab({
  name,
  description,
  basePrice,
  availability,
  onAvailabilityChange,
  categories,
  images,
  groups,
  text,
}: {
  name: string;
  description: string;
  basePrice: string;
  availability: 'available' | 'unavailable';
  onAvailabilityChange: (value: 'available' | 'unavailable') => void;
  categories: CatalogCategorySummary[];
  images: CatalogMediaAsset[];
  groups: GroupDraft[];
  text: (english: string, arabic: string) => string;
}) {
  return (
    <div className="builder-fields">
      <div className="builder-section-heading">
        <span>04</span>
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
            <img src={image.publicUrl} key={image.id} alt="" />
          ))}
        </div>
        <div className="builder-review-copy">
          <div className="builder-review-categories">
            {categories.map((category) => (
              <span key={category.id}>{category.name}</span>
            ))}
          </div>
          <h3>{name || text('Product name', 'اسم المنتج')}</h3>
          <p>{description || text('No description added.', 'لم تتم إضافة وصف.')}</p>
          <strong dir="ltr">EGP {Number(basePrice || 0).toFixed(2)}</strong>
          <small>{text('Sold per piece', 'يباع بالقطعة')}</small>
        </div>
      </div>
      {groups.length > 0 && (
        <div className="builder-review-groups">
          <h3>{text('Customer choices', 'اختيارات العميل')}</h3>
          {groups.map((group) => (
            <article key={group.id}>
              <strong>{group.name || text('Unnamed group', 'مجموعة بدون اسم')}</strong>
              <small>
                {group.minSelections}–{group.maxSelections} {text('choices', 'اختيارات')} ·{' '}
                {group.selectionMode === 'single'
                  ? text('Single choice', 'اختيار واحد')
                  : text('Multiple choice', 'اختيارات متعددة')}
              </small>
              <p>
                {group.options
                  .map(
                    (option) =>
                      `${option.name || text('Unnamed choice', 'اختيار بدون اسم')} (+ EGP ${Number(option.priceAdjustment || 0).toFixed(2)})`,
                  )
                  .join(' · ')}
              </p>
            </article>
          ))}
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

function ProductPreview({
  name,
  description,
  basePrice,
  image,
  categoryName,
  groups,
  total,
  text,
}: {
  name: string;
  description: string;
  basePrice: string;
  image?: string | undefined;
  categoryName?: string | undefined;
  groups: GroupDraft[];
  total: number;
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
        <strong className="preview-base-price">EGP {Number(basePrice || 0).toFixed(2)}</strong>
      </div>
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
        <strong dir="ltr">EGP {total.toFixed(2)}</strong>
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

function toggleList(ids: string[], id: string, checked: boolean) {
  return checked ? [...ids, id] : ids.filter((value) => value !== id);
}
