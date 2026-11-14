import { cacheStockItem } from '../../inventory/stock-unit-options.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useLocale } from '@waffarly/ui';
import type {
  CatalogModifierGroupFields,
  CatalogModifierGroupSummary,
  CatalogCategorySummary,
  CatalogMediaAsset,
  CatalogProductModifierGroupAssignmentFields,
  CatalogProductInventoryConfigurationFields,
  CatalogProductSummary,
  CatalogProductVariantFields,
  OwnerProfile,
  ProductInventoryMode,
  StockItem,
} from '@waffarly/contracts';
import { Icon } from '../../../Icons.js';
import { apiRequest, apiUpload } from '../../../lib/api-client.js';
import { ProductInventoryTab, type ProductInventoryTargetDraft } from './ProductInventoryTab.js';
import type { ChoiceGroupDraft, GroupDraft, VariantDraft } from './product-builder.types.js';
import { ProductInformationTab } from './ProductInformationTab.js';
import { OptionsTab } from './OptionsTab.js';
import { PreviewPublishTab } from './PreviewPublishTab.js';
import { ProductPreview } from './ProductPreview.js';
import { emptyInventoryComponent, inventoryTargetComplete } from './product-inventory.js';

const tabKeys = ['information', 'options', 'inventory', 'review'] as const;

function newId() {
  return crypto.randomUUID();
}

export function ProductBuilderPage() {
  const { profile } = useOutletContext<{ profile: OwnerProfile }>();
  const { locale, errorText, formatNumber, formatDigits } = useLocale();
  const isArabic = locale === 'ar';
  const navigate = useNavigate();
  const { id: productId } = useParams<{ id: string }>();
  const isEditing = Boolean(productId);
  const activityDefaultMode: ProductInventoryMode =
    profile.activity === 'restaurant' ? 'RECIPE' : 'DIRECT';
  const text = (english: string, arabic: string) => formatDigits(isArabic ? arabic : english);
  const [activeTab, setActiveTab] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [availability, setAvailability] = useState<'available' | 'unavailable'>('available');
  const [categories, setCategories] = useState<CatalogCategorySummary[]>([]);
  const [media, setMedia] = useState<CatalogMediaAsset[]>([]);
  const [modifierLibrary, setModifierLibrary] = useState<CatalogModifierGroupSummary[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [imageAssetIds, setImageAssetIds] = useState<string[]>([]);
  const [primaryImageAssetId, setPrimaryImageAssetId] = useState('');
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [pendingChoiceEdits, setPendingChoiceEdits] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [existingVariantIds, setExistingVariantIds] = useState<string[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [configuredStockItemIds, setConfiguredStockItemIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [inventoryMode, setInventoryMode] = useState<ProductInventoryMode>(activityDefaultMode);
  const [inventoryTargets, setInventoryTargets] = useState<ProductInventoryTargetDraft[]>([]);
  const inventoryModeDrafts = useRef<
    Partial<Record<ProductInventoryMode, ProductInventoryTargetDraft[]>>
  >({});
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [inventoryWasConfigured, setInventoryWasConfigured] = useState(false);
  const [inventoryConfigurationRequired, setInventoryConfigurationRequired] = useState(false);
  const [productMode, setProductMode] = useState<'simple' | 'variants'>('simple');
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
      apiRequest<CatalogModifierGroupSummary[]>('/owner/catalog/modifier-groups'),
    ])
      .then(([nextCategories, nextMedia, nextModifierLibrary]) => {
        setCategories(nextCategories.filter((category) => !category.archivedAt));
        setMedia(nextMedia);
        setModifierLibrary(nextModifierLibrary);
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
    inventoryModeDrafts.current = {};
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
      setVariants([]);
      setExistingVariantIds([]);
      setProductMode('simple');
      setInventoryMode(activityDefaultMode);
      setInventoryTargets([]);
      setConfiguredStockItemIds(new Set());
      setInventoryEnabled(false);
      setInventoryWasConfigured(false);
      setInventoryConfigurationRequired(false);
      return () => {
        cancelled = true;
      };
    }

    setProductLoading(true);
    void apiRequest<CatalogProductSummary>(`/owner/catalog/products/${productId}`)
      .then((product) => {
        if (cancelled) return;
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
              modifierGroupId: group.modifierGroupId,
              variantOverrides: group.variantOverrides,
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
                  maxQuantity: option.maxQuantity ?? 1,
                  effects: option.effects,
                  variantOverrides: option.variantOverrides,
                  defaultSelected: option.defaultSelected,
                })),
            })),
        );
        setVariants(
          [...product.variants]
            .sort((a, b) => a.position - b.position)
            .map((variant) => ({
              id: variant.id,
              name: variant.name,
              sku: variant.sku ?? '',
              barcode: variant.barcode ?? '',
              price: variant.price,
              stockQuantity: variant.stockQuantity === null ? '' : String(variant.stockQuantity),
              availability: variant.availability,
              attributes: variant.attributes.map((attribute) => ({
                attributeId: attribute.attributeId,
                valueId: attribute.valueId,
                name: attribute.attributeName,
                value: attribute.value,
              })),
            })),
        );
        setExistingVariantIds(product.variants.map((variant) => variant.id));
        setProductMode(product.variants.length ? 'variants' : 'simple');
        setInventoryMode(product.inventoryConfiguration?.mode ?? product.inventoryDefaultMode);
        setInventoryTargets(
          product.inventoryConfiguration?.targets.map((target) => ({
            variantId: target.variantId,
            components: target.components.map((component) => ({
              stockItemId: component.stockItemId,
              unitCode: component.unitCode,
              quantity: component.quantity,
            })),
          })) ?? [],
        );
        setInventoryEnabled(product.inventoryConfiguration !== null);
        setConfiguredStockItemIds(
          new Set(
            product.inventoryConfiguration?.targets.flatMap((target) =>
              target.components.map((component) => component.stockItemId),
            ) ?? [],
          ),
        );
        setInventoryWasConfigured(product.inventoryConfiguration !== null);
        setInventoryConfigurationRequired(product.inventoryConfigurationRequired);
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
  const inventorySellables = variants.length
    ? variants.map((variant) => ({ variantId: variant.id, name: variant.name }))
    : [{ variantId: null, name }];
  const displayedInventoryTargets: ProductInventoryTargetDraft[] = inventorySellables.map(
    (sellable) =>
      inventoryTargets.find((target) => target.variantId === sellable.variantId) ?? {
        variantId: sellable.variantId,
        components: [emptyInventoryComponent(inventoryMode)],
      },
  );
  const inventoryConfigurationComplete =
    inventoryEnabled &&
    displayedInventoryTargets.length > 0 &&
    displayedInventoryTargets.every((target) => {
      if (!inventoryTargetComplete(target, inventoryMode, stockItems)) return false;
      return target.components.every(
        (component) =>
          configuredStockItemIds.has(component.stockItemId) ||
          stockItems.some((item) => item.id === component.stockItemId),
      );
    });
  function saveInventoryDraft(mode: ProductInventoryMode, targets: ProductInventoryTargetDraft[]) {
    if (mode !== inventoryMode) {
      inventoryModeDrafts.current[inventoryMode] = structuredClone(inventoryTargets);
    }
    inventoryModeDrafts.current[mode] = structuredClone(targets);
    setInventoryMode(mode);
    setInventoryTargets(structuredClone(targets));
  }

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

  function validateStep(step: number, finalSave = false): boolean {
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
      if (!categoryIds.length) {
        setError(text('Choose at least one category.', 'اختر تصنيفاً واحداً على الأقل.'));
        return false;
      }
      if (!imageAssetIds.length) {
        setError(text('Add at least one product image.', 'أضف صورة واحدة على الأقل للمنتج.'));
        return false;
      }
    }
    if (step === 1) {
      const duplicateSku = new Set<string>();
      const duplicateBarcode = new Set<string>();
      const invalidVariant = variants.find((variant) => {
        const sku = variant.sku.trim().toLocaleLowerCase();
        const barcode = variant.barcode.trim().toLocaleLowerCase();
        const attributeNames = variant.attributes.map((attribute) =>
          attribute.name.trim().toLocaleLowerCase(),
        );
        const invalidAttributes =
          variant.attributes.some(
            (attribute) => !attribute.name.trim() || !attribute.value.trim(),
          ) || new Set(attributeNames).size !== attributeNames.length;
        const duplicate =
          (sku && duplicateSku.has(sku)) || (barcode && duplicateBarcode.has(barcode));
        if (sku) duplicateSku.add(sku);
        if (barcode) duplicateBarcode.add(barcode);
        return (
          !variant.name.trim() ||
          !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(variant.price) ||
          Number(variant.price) <= 0 ||
          (variant.stockQuantity !== '' &&
            (!/^\d+$/.test(variant.stockQuantity) ||
              !Number.isSafeInteger(Number(variant.stockQuantity)) ||
              Number(variant.stockQuantity) > 2_147_483_647)) ||
          invalidAttributes ||
          duplicate
        );
      });
      if (invalidVariant) {
        setError(
          text(
            'Check each variant: enter a name and positive price, use a whole-number stock count, and keep SKU/barcode values unique.',
            'راجع كل متغير: أدخل الاسم والسعر الموجب، واستخدم كمية مخزون صحيحة، وتأكد من عدم تكرار SKU أو الباركود.',
          ),
        );
        return false;
      }
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
    if (step === 2) {
      if (!finalSave) {
        setError('');
        return true;
      }
      const requireConfiguration =
        availability === 'available' && (!isEditing || inventoryConfigurationRequired);
      if (inventoryEnabled && !inventoryConfigurationComplete) {
        if (requireConfiguration || inventoryWasConfigured) {
          setError(
            text(
              'Complete every inventory target with a Stock Item, unit, and positive quantity.',
              'أكمل إعداد كل وحدة بيع باختيار صنف المخزون والوحدة والكمية الموجبة.',
            ),
          );
          return false;
        }
      }
      if (requireConfiguration && !inventoryConfigurationComplete) {
        setError(
          text(
            'Configure inventory before making this product available.',
            'أكمل إعداد المخزون قبل إتاحة هذا المنتج.',
          ),
        );
        return false;
      }
      if (inventoryWasConfigured && !inventoryEnabled && availability === 'available') {
        setError(
          text(
            'Set the product as unavailable before removing its inventory setup.',
            'اجعل المنتج غير متاح قبل إزالة إعداد المخزون.',
          ),
        );
        return false;
      }
    }
    setError('');
    return true;
  }

  function addGroupFromLibrary(groupId: string) {
    const definition = modifierLibrary.find((group) => group.id === groupId);
    if (
      !definition ||
      groups.length >= 30 ||
      groups.some((group) => group.modifierGroupId === definition.id)
    )
      return;
    setGroups((current) => [
      ...current,
      {
        id: newId(),
        modifierGroupId: definition.id,
        name: definition.name,
        description: definition.description ?? '',
        selectionMode: 'single',
        minSelections: 0,
        maxSelections: 1,
        options: [...definition.options]
          .sort((a, b) => a.position - b.position)
          .map((option) => ({
            id: option.id,
            name: option.name,
            priceAdjustment: '0.00',
            defaultSelected: false,
          })),
      },
    ]);
  }

  async function createAndAddModifierGroup(draft: ChoiceGroupDraft): Promise<string | null> {
    const options = draft.options.map((option) => ({ ...option, name: option.name.trim() }));
    if (!draft.name.trim() || options.length === 0 || options.some((option) => !option.name)) {
      return text(
        'Enter a group name and at least one option.',
        'أدخل اسم المجموعة وخياراً واحداً على الأقل.',
      );
    }
    if (groups.length >= 30) {
      return text(
        'This product has the maximum of 30 choice groups.',
        'وصل المنتج إلى الحد الأقصى: 30 مجموعة خيارات.',
      );
    }
    if (options.length > 100) {
      return text(
        'A group can have up to 100 options.',
        'يمكن أن تحتوي المجموعة على 100 خيار كحد أقصى.',
      );
    }
    setSubmitting(true);
    setError('');
    try {
      const body: CatalogModifierGroupFields = {
        name: draft.name.trim(),
        options: options.map((option, position) => ({ name: option.name, position })),
      };
      const created = await apiRequest<CatalogModifierGroupSummary>(
        '/owner/catalog/modifier-groups',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      setModifierLibrary((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setGroups((current) => [
        ...current,
        {
          id: newId(),
          modifierGroupId: created.id,
          name: created.name,
          description: created.description ?? '',
          variantOverrides: draft.variantOverrides,
          selectionMode: draft.selectionMode,
          minSelections: draft.minSelections,
          maxSelections: draft.maxSelections,
          options: [...created.options]
            .sort((a, b) => a.position - b.position)
            .map((option, index) => ({
              ...options[index],
              id: option.id,
              name: option.name,
              priceAdjustment:
                options.find((entry) => entry.name === option.name)?.priceAdjustment ?? '0.00',
              defaultSelected: options[index]?.defaultSelected ?? false,
            })),
        },
      ]);
      return null;
    } catch (cause) {
      return cause instanceof Error
        ? errorText(cause.message)
        : text('Could not create modifier group.', 'تعذر إنشاء مجموعة الخيارات.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateModifierGroup(draft: GroupDraft): Promise<string | null> {
    const current = groups.find((group) => group.id === draft.id);
    if (!current)
      return text(
        'This choice group is no longer on the product.',
        'لم تعد مجموعة الخيارات موجودة على المنتج.',
      );
    const definitionChanged =
      current.name !== draft.name ||
      current.options.length !== draft.options.length ||
      current.options.some(
        (option, index) =>
          option.id !== draft.options[index]?.id || option.name !== draft.options[index]?.name,
      );
    if (!definitionChanged) {
      setGroups((items) =>
        items.map((group) =>
          group.id === draft.id ? { ...draft, modifierGroupId: current.modifierGroupId } : group,
        ),
      );
      return null;
    }
    setSubmitting(true);
    setError('');
    try {
      const created = await apiRequest<CatalogModifierGroupSummary>(
        '/owner/catalog/modifier-groups',
        {
          method: 'POST',
          body: JSON.stringify({
            name: draft.name,
            description: draft.description || undefined,
            options: draft.options.map((option, position) => ({ name: option.name, position })),
          } satisfies CatalogModifierGroupFields),
        },
      );
      const updated: GroupDraft = {
        ...draft,
        modifierGroupId: created.id,
        name: created.name,
        options: [...created.options]
          .sort((a, b) => a.position - b.position)
          .map((option, index) => ({ ...draft.options[index]!, id: option.id, name: option.name })),
      };
      setModifierLibrary((items) =>
        [...items, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setGroups((items) => items.map((group) => (group.id === draft.id ? updated : group)));
      return null;
    } catch (cause) {
      return cause instanceof Error
        ? errorText(cause.message)
        : text('Could not update these choices.', 'تعذر تحديث هذه الخيارات.');
    } finally {
      setSubmitting(false);
    }
  }

  function applyVariants(next: VariantDraft[]) {
    setVariants(next);
    setProductMode(next.length ? 'variants' : 'simple');
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

  async function submitProduct() {
    if (pendingChoiceEdits) {
      setError(
        text(
          'Apply or discard your unfinished choice edits before saving the product.',
          'طبّق تعديلات الخيارات غير المكتملة أو تجاهلها قبل حفظ المنتج.',
        ),
      );
      setActiveTab(1);
      return;
    }
    if (isEditing && revision === null) {
      setError(text('The product is not ready to save.', 'المنتج غير جاهز للحفظ.'));
      return;
    }
    for (let step = 0; step <= 2; step += 1) {
      if (!validateStep(step, step === 2)) {
        setActiveTab(step);
        return;
      }
    }
    setSubmitting(true);
    setError('');
    const modifierGroupAssignments: CatalogProductModifierGroupAssignmentFields[] = groups.map(
      (group, groupPosition) => ({
        modifierGroupId: group.modifierGroupId,
        variantOverrides: group.variantOverrides?.filter((override) =>
          variants.some((variant) => variant.id === override.variantId),
        ),
        selectionMode: group.selectionMode,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        position: groupPosition,
        options: group.options.map((option) => ({
          optionId: option.id,
          maxQuantity: option.maxQuantity ?? 1,
          effects: option.effects,
          variantOverrides: option.variantOverrides?.filter((override) =>
            variants.some((variant) => variant.id === override.variantId),
          ),
          priceAdjustment: Number(option.priceAdjustment).toFixed(2),
          defaultSelected: option.defaultSelected,
        })),
      }),
    );
    const productVariants: CatalogProductVariantFields[] = variants.map((variant, position) => ({
      id:
        !isEditing ||
        existingVariantIds.includes(variant.id) ||
        inventoryConfigurationComplete ||
        groups.some(
          (group) =>
            group.variantOverrides?.length ||
            group.options.some((option) => option.variantOverrides?.length),
        )
          ? variant.id
          : undefined,
      name: variant.name.trim(),
      sku: variant.sku.trim() || undefined,
      barcode: variant.barcode.trim() || undefined,
      price: Number(variant.price).toFixed(2),
      stockQuantity: variant.stockQuantity === '' ? null : Number(variant.stockQuantity),
      availability: variant.availability,
      position,
      attributes: variant.attributes.map((attribute) => ({
        ...(attribute.attributeId ? { attributeId: attribute.attributeId } : {}),
        ...(attribute.valueId ? { valueId: attribute.valueId } : {}),
        name: attribute.name.trim(),
        value: attribute.value.trim(),
      })),
    }));
    const inventoryConfiguration: CatalogProductInventoryConfigurationFields | undefined =
      inventoryConfigurationComplete
        ? {
            mode: inventoryMode,
            targets: displayedInventoryTargets.map((target) => ({
              variantId: target.variantId,
              components: target.components.map((component) => ({
                stockItemId: component.stockItemId,
                unitCode: component.unitCode,
                quantity: component.quantity,
              })),
            })),
          }
        : undefined;
    const inventoryConfigurationField = inventoryEnabled
      ? inventoryConfiguration
        ? { inventoryConfiguration }
        : {}
      : inventoryWasConfigured
        ? { inventoryConfiguration: null }
        : {};
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
            modifierGroupAssignments,
            variants: productVariants,
            ...inventoryConfigurationField,
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
    text('Product information', 'معلومات المنتج'),
    text('Options', 'الخيارات'),
    text('Inventory', 'المخزون'),
    text('Preview and publish', 'المعاينة والنشر'),
  ];

  return (
    <div className="product-builder-page" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="product-builder-topbar product-builder-actions-only">
        <h1 className="sr-only">
          {isEditing
            ? text('Edit product', 'تعديل المنتج')
            : text('Create a product', 'إضافة منتج')}
        </h1>
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
            tabIndex={activeTab === index ? 0 : -1}
            aria-selected={activeTab === index}
            aria-controls={`product-builder-panel-${tabKeys[index]}`}
            id={`product-builder-tab-${tabKeys[index]}`}
            className={`builder-step ${activeTab === index ? 'active' : ''}`}
            key={tabKeys[index]}
            onKeyDown={(event) => {
              const direction = isArabic ? -1 : 1;
              const offset =
                event.key === 'ArrowRight' ? direction : event.key === 'ArrowLeft' ? -direction : 0;
              const target =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabKeys.length - 1
                    : offset
                      ? (index + offset + tabKeys.length) % tabKeys.length
                      : null;
              if (target === null) return;
              event.preventDefault();
              setError('');
              setActiveTab(target);
              event.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>(`#product-builder-tab-${tabKeys[target]}`)
                ?.focus();
            }}
            onClick={() => {
              setError('');
              setActiveTab(index);
            }}
          >
            <span>{index + 1}</span>
            <strong>
              {label}
              <small>
                {
                  [
                    text('Details, category & photos', 'البيانات والتصنيف والصور'),
                    text('Variants & add-ons', 'المتغيرات والإضافات'),
                    text('Direct item or recipe', 'صنف مباشر أو وصفة'),
                    text('Review & save', 'المراجعة والحفظ'),
                  ][index]
                }
              </small>
            </strong>
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
                <ProductInformationTab
                  name={name}
                  onNameChange={setName}
                  description={description}
                  onDescriptionChange={setDescription}
                  basePrice={basePrice}
                  onBasePriceChange={setBasePrice}
                  productMode={productMode}
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
              <div hidden={activeTab !== 1}>
                <OptionsTab
                  key={productId ?? 'new-product'}
                  groups={groups}
                  recipe={inventoryEnabled && inventoryMode === 'RECIPE'}
                  productMode={productMode}
                  modifierLibrary={modifierLibrary}
                  libraryLoading={loading}
                  basePrice={basePrice}
                  onAddGroupFromLibrary={addGroupFromLibrary}
                  onCreateAndAddGroup={createAndAddModifierGroup}
                  onSaveGroup={updateModifierGroup}
                  onPendingEditsChange={setPendingChoiceEdits}
                  creatingGroup={submitting}
                  onGroupsChange={setGroups}
                  onMoveGroup={moveGroup}
                  variants={variants}
                  onVariantsChange={applyVariants}
                  text={text}
                />
              </div>
              {activeTab === 2 && (
                <ProductInventoryTab
                  productName={name}
                  enabled={inventoryEnabled}
                  onEnabledChange={setInventoryEnabled}
                  mode={inventoryMode}
                  defaultMode={activityDefaultMode}
                  savedModes={inventoryModeDrafts.current}
                  required={!isEditing || inventoryConfigurationRequired}
                  availability={availability}
                  stockItems={stockItems}
                  onStockItemLoaded={(item) =>
                    setStockItems((current) => cacheStockItem(current, item))
                  }
                  targets={displayedInventoryTargets}
                  variants={variants.map((variant) => ({ id: variant.id, name: variant.name }))}
                  onInventorySave={saveInventoryDraft}
                  text={text}
                />
              )}
              {activeTab === 3 && (
                <PreviewPublishTab
                  onEditStep={(step) => {
                    if (!submitting) {
                      setError('');
                      setActiveTab(step);
                    }
                  }}
                  name={name}
                  description={description}
                  basePrice={basePrice}
                  productMode={productMode}
                  availability={availability}
                  onAvailabilityChange={setAvailability}
                  categories={selectedCategories}
                  images={selectedImages.filter((asset): asset is CatalogMediaAsset =>
                    Boolean(asset),
                  )}
                  groups={groups}
                  variants={variants}
                  inventoryMode={inventoryMode}
                  inventoryConfigured={
                    inventoryConfigurationComplete || (inventoryWasConfigured && inventoryEnabled)
                  }
                  inventoryRequired={!isEditing || inventoryConfigurationRequired}
                  formatNumber={formatNumber}
                  text={text}
                />
              )}
              {pendingChoiceEdits && activeTab !== 1 && (
                <div className="composer-inline-notice" role="status">
                  <span>
                    {text(
                      'You have unfinished changes to customer choices.',
                      'لديك تعديلات غير مكتملة على خيارات العميل.',
                    )}
                  </span>
                  <button
                    type="button"
                    className="builder-text-button"
                    onClick={() => {
                      setError('');
                      setActiveTab(1);
                    }}
                  >
                    {text('Continue editing', 'متابعة التعديل')}
                  </button>
                </div>
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
                    disabled={uploading || submitting}
                    onClick={() =>
                      validateStep(activeTab) && setActiveTab((current) => Math.min(3, current + 1))
                    }
                  >
                    {activeTab === 1 && !groups.length && !variants.length
                      ? text('Continue without choices', 'متابعة بدون خيارات')
                      : activeTab === 2
                        ? text('Review product', 'مراجعة المنتج')
                        : `${text('Next: ', 'التالي: ')}${tabs[activeTab + 1]}`}
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
            variants={variants}
            formatNumber={formatNumber}
            text={text}
          />
        </div>
      )}
    </div>
  );
}
