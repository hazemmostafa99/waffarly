import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
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
import { Icon } from './Icons.js';
import { apiRequest, apiUpload } from './lib/api-client.js';
import {
  ProductInventoryTab,
  type ProductInventoryComponentDraft,
  type ProductInventoryTargetDraft,
} from './ProductInventoryTab.js';

type OptionDraft = {
  id: string;
  name: string;
  priceAdjustment: string;
  defaultSelected: boolean;
};

type GroupDraft = {
  id: string;
  modifierGroupId: string;
  name: string;
  description: string;
  selectionMode: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  options: OptionDraft[];
};

type VariantDraft = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: string;
  stockQuantity: string;
  availability: 'available' | 'unavailable';
  attributes: Array<{ attributeId?: string; valueId?: string; name: string; value: string }>;
};

const tabKeys = ['basic', 'details', 'options', 'inventory', 'preview'] as const;

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
  const [selectedLibraryGroupId, setSelectedLibraryGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupOptions, setNewGroupOptions] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [imageAssetIds, setImageAssetIds] = useState<string[]>([]);
  const [primaryImageAssetId, setPrimaryImageAssetId] = useState('');
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [existingVariantIds, setExistingVariantIds] = useState<string[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [inventoryMode, setInventoryMode] = useState<ProductInventoryMode>(activityDefaultMode);
  const [inventoryTargets, setInventoryTargets] = useState<ProductInventoryTargetDraft[]>([]);
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
      apiRequest<StockItem[]>('/owner/inventory/items?status=active&limit=100'),
    ])
      .then(([nextCategories, nextMedia, nextModifierLibrary, nextStockItems]) => {
        setCategories(nextCategories.filter((category) => !category.archivedAt));
        setMedia(nextMedia);
        setModifierLibrary(nextModifierLibrary);
        setStockItems(nextStockItems.filter((item) => !item.archivedAt));
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
      setVariants([]);
      setExistingVariantIds([]);
      setProductMode('simple');
      setInventoryMode(activityDefaultMode);
      setInventoryTargets([]);
      setInventoryEnabled(false);
      setInventoryWasConfigured(false);
      setInventoryConfigurationRequired(false);
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
              modifierGroupId: group.modifierGroupId,
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
        components: [{ stockItemId: '', unitCode: '', quantity: '1' }],
      },
  );
  const inventoryConfigurationComplete =
    inventoryEnabled &&
    displayedInventoryTargets.length > 0 &&
    displayedInventoryTargets.every((target) => {
      if (!target.components.length || (inventoryMode === 'DIRECT' && target.components.length !== 1)) {
        return false;
      }
      return target.components.every((component) =>
        stockItems.some((item) => item.id === component.stockItemId) &&
        component.unitCode.length > 0 &&
        /^(0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(component.quantity) &&
        Number(component.quantity) > 0,
      );
    });
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

  function changeInventoryTarget(
    variantId: string | null,
    components: ProductInventoryComponentDraft[],
  ) {
    setInventoryTargets((current) => {
      const existingIndex = current.findIndex((target) => target.variantId === variantId);
      const nextTarget = { variantId, components };
      return existingIndex < 0
        ? [...current, nextTarget]
        : current.map((target, index) => (index === existingIndex ? nextTarget : target));
    });
  }

  function changeInventoryMode(mode: ProductInventoryMode) {
    setInventoryMode(mode);
    if (mode === 'DIRECT') {
      setInventoryTargets((current) =>
        current.map((target) => ({ ...target, components: target.components.slice(0, 1) })),
      );
    }
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
      const duplicateSku = new Set<string>();
      const duplicateBarcode = new Set<string>();
      const invalidVariant = variants.find((variant) => {
        const sku = variant.sku.trim().toLocaleLowerCase();
        const barcode = variant.barcode.trim().toLocaleLowerCase();
        const attributeNames = variant.attributes.map((attribute) => attribute.name.trim().toLocaleLowerCase());
        const invalidAttributes = variant.attributes.some(
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
    if (step === 3) {
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

  function addGroupFromLibrary() {
    const definition = modifierLibrary.find((group) => group.id === selectedLibraryGroupId);
    if (!definition || groups.some((group) => group.modifierGroupId === definition.id)) return;
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
    setSelectedLibraryGroupId('');
  }

  async function createAndAddModifierGroup() {
    const optionNames = newGroupOptions
      .split(/\r?\n/)
      .map((option) => option.trim())
      .filter(Boolean);
    if (!newGroupName.trim() || optionNames.length === 0) {
      setError(text('Enter a group name and at least one option.', 'أدخل اسم المجموعة وخياراً واحداً على الأقل.'));
      return;
    }
    if (optionNames.length > 100) {
      setError(text('A group can have up to 100 options.', 'يمكن أن تحتوي المجموعة على 100 خيار كحد أقصى.'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body: CatalogModifierGroupFields = {
        name: newGroupName.trim(),
        options: optionNames.map((option, position) => ({ name: option, position })),
      };
      const created = await apiRequest<CatalogModifierGroupSummary>('/owner/catalog/modifier-groups', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setModifierLibrary((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedLibraryGroupId(created.id);
      setNewGroupName('');
      setNewGroupOptions('');
      setGroups((current) => [
        ...current,
        {
          id: newId(),
          modifierGroupId: created.id,
          name: created.name,
          description: created.description ?? '',
          selectionMode: 'single',
          minSelections: 0,
          maxSelections: 1,
          options: created.options.map((option) => ({
            id: option.id,
            name: option.name,
            priceAdjustment: '0.00',
            defaultSelected: false,
          })),
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text('Could not create modifier group.', 'تعذر إنشاء مجموعة الخيارات.'));
    } finally {
      setSubmitting(false);
    }
  }

  function addVariant() {
    setProductMode('variants');
    setVariants((current) => [
      ...current,
      {
        id: newId(),
        name: '',
        sku: '',
        barcode: '',
        price: basePrice || '0',
        stockQuantity: '',
        availability: 'available',
        attributes: [],
      },
    ]);
  }

  function changeProductMode(mode: 'simple' | 'variants') {
    setProductMode(mode);
    if (mode === 'simple') {
      setVariants([]);
    } else if (variants.length === 0) {
      addVariant();
    }
  }

  function removeVariant(variantId: string) {
    const next = variants.filter((variant) => variant.id !== variantId);
    setVariants(next);
    if (next.length === 0) setProductMode('simple');
  }

  function changeVariant(variantId: string, update: Partial<VariantDraft>) {
    setVariants((current) =>
      current.map((variant) => (variant.id === variantId ? { ...variant, ...update } : variant)),
    );
  }

  function changeVariantAttribute(
    variantId: string,
    attributeIndex: number,
    update: Partial<VariantDraft['attributes'][number]>,
  ) {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              attributes: variant.attributes.map((attribute, index) =>
                index === attributeIndex ? { ...attribute, ...update } : attribute,
              ),
            }
          : variant,
      ),
    );
  }

  function addVariantAttribute(variantId: string) {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId
          ? { ...variant, attributes: [...variant.attributes, { name: '', value: '' }] }
          : variant,
      ),
    );
  }

  function removeVariantAttribute(variantId: string, attributeIndex: number) {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId
          ? { ...variant, attributes: variant.attributes.filter((_, index) => index !== attributeIndex) }
          : variant,
      ),
    );
  }

  function moveVariant(index: number, direction: -1 | 1) {
    setVariants((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
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

  async function submitProduct() {
    if (isEditing && revision === null) {
      setError(text('The product is not ready to save.', 'المنتج غير جاهز للحفظ.'));
      return;
    }
    for (let step = 0; step <= 3; step += 1) {
      if (!validateStep(step, step === 3)) {
        setActiveTab(step);
        return;
      }
    }
    setSubmitting(true);
    setError('');
    const modifierGroupAssignments: CatalogProductModifierGroupAssignmentFields[] = groups.map(
      (group, groupPosition) => ({
        modifierGroupId: group.modifierGroupId,
        selectionMode: group.selectionMode,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        position: groupPosition,
        options: group.options.map((option) => ({
          optionId: option.id,
          priceAdjustment: Number(option.priceAdjustment).toFixed(2),
          defaultSelected: option.defaultSelected,
        })),
      }),
    );
    const productVariants: CatalogProductVariantFields[] = variants.map((variant, position) => ({
      id: !isEditing || existingVariantIds.includes(variant.id) || inventoryConfigurationComplete
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
    text('Basic information', 'المعلومات الأساسية'),
    text('Product details', 'تفاصيل المنتج'),
    text('Options', 'الخيارات'),
    text('Inventory', 'المخزون'),
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
            tabIndex={activeTab === index ? 0 : -1}
            aria-selected={activeTab === index}
            aria-controls={`product-builder-panel-${tabKeys[index]}`}
            id={`product-builder-tab-${tabKeys[index]}`}
            className={`builder-step ${activeTab === index ? 'active' : ''}`}
            key={tabKeys[index]}
            onKeyDown={(event) => {
              const direction = isArabic ? -1 : 1;
              const offset = event.key === 'ArrowRight' ? direction : event.key === 'ArrowLeft' ? -direction : 0;
              const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabKeys.length - 1 : offset ? (index + offset + tabKeys.length) % tabKeys.length : null;
              if (target === null) return;
              event.preventDefault();
              setError('');
              setActiveTab(target);
              event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#product-builder-tab-${tabKeys[target]}`)?.focus();
            }}
            onClick={() => {
              setError('');
              setActiveTab(index);
            }}
          >
            <span>{index + 1}</span>
            <strong>
              {label}
              <small>{[
                text('Name & price', 'الاسم والسعر'),
                text('Categories & photos', 'التصنيفات والصور'),
                text('Variants & add-ons', 'المتغيرات والإضافات'),
                text('Direct item or recipe', 'صنف مباشر أو وصفة'),
                text('Review & save', 'المراجعة والحفظ'),
              ][index]}</small>
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
                  productMode={productMode}
                  onProductModeChange={changeProductMode}
                  modifierLibrary={modifierLibrary}
                  libraryLoading={loading}
                  selectedLibraryGroupId={selectedLibraryGroupId}
                  onSelectedLibraryGroupChange={setSelectedLibraryGroupId}
                  newGroupName={newGroupName}
                  onNewGroupNameChange={setNewGroupName}
                  newGroupOptions={newGroupOptions}
                  onNewGroupOptionsChange={setNewGroupOptions}
                  onAddGroupFromLibrary={addGroupFromLibrary}
                  onCreateAndAddGroup={() => void createAndAddModifierGroup()}
                  creatingGroup={submitting}
                  onGroupsChange={setGroups}
                  onGroupChange={changeGroup}
                  onOptionChange={changeOption}
                  onMoveGroup={moveGroup}
                  variants={variants}
                  onVariantChange={changeVariant}
                  onVariantAttributeChange={changeVariantAttribute}
                  onAddVariantAttribute={addVariantAttribute}
                  onRemoveVariantAttribute={removeVariantAttribute}
                  onAddVariant={addVariant}
                  onRemoveVariant={removeVariant}
                  onMoveVariant={moveVariant}
                  text={text}
                />
              )}
              {activeTab === 3 && (
                <ProductInventoryTab
                  enabled={inventoryEnabled}
                  onEnabledChange={setInventoryEnabled}
                  mode={inventoryMode}
                  onModeChange={changeInventoryMode}
                  defaultMode={activityDefaultMode}
                  required={!isEditing || inventoryConfigurationRequired}
                  availability={availability}
                  stockItems={stockItems}
                  targets={displayedInventoryTargets}
                  variants={variants.map((variant) => ({ id: variant.id, name: variant.name }))}
                  onTargetChange={changeInventoryTarget}
                  text={text}
                />
              )}
              {activeTab === 4 && (
                <PreviewPublishTab
                  onEditStep={(step) => { if (!submitting) { setError(''); setActiveTab(step); } }}
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
                  variants={variants}
                  inventoryMode={inventoryMode}
                  inventoryConfigured={inventoryConfigurationComplete || (inventoryWasConfigured && inventoryEnabled)}
                  formatNumber={formatNumber}
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
                {activeTab < 4 ? (
                  <button
                    type="button"
                    className="builder-button primary"
                    disabled={uploading}
                    onClick={() =>
                      validateStep(activeTab) && setActiveTab((current) => Math.min(4, current + 1))
                    }
                  >
                    {activeTab === 3 ? text('Review product', 'مراجعة المنتج') : `${text('Next: ', 'التالي: ')}${tabs[activeTab + 1]}`}
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
            total={
              (variants.length
                ? Math.min(...variants.map((variant) => Number(variant.price || 0)))
                : Number(basePrice || 0)) + defaultAdjustment
            }
            formatNumber={formatNumber}
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
        <small>{text(String(description.length), String(description.length))}/{text('1000', '1000')}</small>
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
        <span>{text('02', '02')}</span>
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
  productMode,
  onProductModeChange,
  modifierLibrary,
  libraryLoading,
  selectedLibraryGroupId,
  onSelectedLibraryGroupChange,
  newGroupName,
  onNewGroupNameChange,
  newGroupOptions,
  onNewGroupOptionsChange,
  onAddGroupFromLibrary,
  onCreateAndAddGroup,
  creatingGroup,
  onGroupsChange,
  onGroupChange,
  onOptionChange,
  onMoveGroup,
  variants,
  onVariantChange,
  onVariantAttributeChange,
  onAddVariantAttribute,
  onRemoveVariantAttribute,
  onAddVariant,
  onRemoveVariant,
  onMoveVariant,
  text,
}: {
  groups: GroupDraft[];
  productMode: 'simple' | 'variants';
  onProductModeChange: (mode: 'simple' | 'variants') => void;
  modifierLibrary: CatalogModifierGroupSummary[];
  libraryLoading: boolean;
  selectedLibraryGroupId: string;
  onSelectedLibraryGroupChange: (id: string) => void;
  newGroupName: string;
  onNewGroupNameChange: (value: string) => void;
  newGroupOptions: string;
  onNewGroupOptionsChange: (value: string) => void;
  onAddGroupFromLibrary: () => void;
  onCreateAndAddGroup: () => void;
  creatingGroup: boolean;
  onGroupsChange: (groups: GroupDraft[]) => void;
  onGroupChange: (id: string, update: Partial<GroupDraft>) => void;
  onOptionChange: (groupId: string, optionId: string, update: Partial<OptionDraft>) => void;
  onMoveGroup: (index: number, direction: -1 | 1) => void;
  variants: VariantDraft[];
  onVariantChange: (id: string, update: Partial<VariantDraft>) => void;
  onVariantAttributeChange: (
    id: string,
    index: number,
    update: Partial<VariantDraft['attributes'][number]>,
  ) => void;
  onAddVariantAttribute: (id: string) => void;
  onRemoveVariantAttribute: (id: string, index: number) => void;
  onAddVariant: () => void;
  onRemoveVariant: (id: string) => void;
  onMoveVariant: (index: number, direction: -1 | 1) => void;
  text: (english: string, arabic: string) => string;
}) {
  const availableLibraryGroups = modifierLibrary.filter(
    (group) => !groups.some((assigned) => assigned.modifierGroupId === group.id),
  );
  const [groupEntryMode, setGroupEntryMode] = useState<'library' | 'create'>(
    availableLibraryGroups.length ? 'library' : 'create',
  );
  const newGroupOptionCount = newGroupOptions
    .split(/\r?\n/)
    .filter((option) => option.trim()).length;
  const [confirmSimpleMode, setConfirmSimpleMode] = useState(false);
  return (
    <div className="builder-fields">
      <div className="builder-section-heading builder-heading-action">
        <span>{text('03', '03')}</span>
        <div>
          <h2>{text('Options', 'الخيارات')}</h2>
          <p>
            {text(
              'Choose how you sell this product, then add any customer choices.',
              'اختر طريقة بيع المنتج، ثم أضف الخيارات التي يحتاجها العميل.',
            )}
          </p>
        </div>
        <div className="builder-heading-buttons">
          <button
            type="button"
            className="builder-button"
            onClick={onAddVariant}
            disabled={variants.length >= 100}
          >
            <Icon name="plus" />
            {text('Add variant', 'إضافة متغير')}
          </button>
        </div>
      </div>
      <details className="builder-advanced builder-options-help">
        <summary>{text('When should I use variants or add-ons?', 'متى أستخدم المتغيرات أو الإضافات؟')}</summary>
      <div className="builder-info-banner">
        <span>i</span>
        <p>
          {text(
            'Variants are separately priced versions of a product. Add-ons are customer choices. SKU, barcode, and stock tracking are optional.',
            'المتغيرات نسخ من المنتج بأسعار مستقلة، أما الإضافات فهي خيارات للعميل. تتبّع المخزون وحقولا SKU والباركود اختيارية.',
          )}
        </p>
      </div>
      </details>
      <fieldset className="builder-product-mode">
        <legend>{text('Product type', 'نوع المنتج')}</legend>
        <label className={productMode === 'simple' ? 'selected' : ''}>
          <input type="radio" name="product-mode" checked={productMode === 'simple'} onChange={() => {
            if (variants.length > 0) {
              setConfirmSimpleMode(true);
            } else onProductModeChange('simple');
          }} />
          <span>
            <strong>{text('Simple product', 'منتج بسيط')}</strong>
            <small>{text('One price, with no sellable variants.', 'سعر واحد بدون متغيرات قابلة للبيع.')}</small>
          </span>
        </label>
        <label className={productMode === 'variants' ? 'selected' : ''}>
          <input type="radio" name="product-mode" checked={productMode === 'variants'} onChange={() => onProductModeChange('variants')} />
          <span>
            <strong>{text('Product with variants', 'منتج بمتغيرات')}</strong>
            <small>{text('Each variant has its own price and optional SKU, barcode, and stock.', 'لكل متغير سعره الخاص ورمز SKU وباركود ومخزون اختياري.')}</small>
          </span>
        </label>
      </fieldset>
      {confirmSimpleMode && (
        <div className="builder-mode-confirmation" role="alert">
          <p>{text('Switching to a simple product removes the variants you entered. Keep them or use one product price?', 'التحويل إلى منتج بسيط يزيل المتغيرات التي أدخلتها. هل تريد الاحتفاظ بها أم استخدام سعر واحد للمنتج؟')}</p>
          <div>
            <button type="button" className="builder-button" onClick={() => setConfirmSimpleMode(false)}>{text('Keep variants', 'الاحتفاظ بالمتغيرات')}</button>
            <button type="button" className="builder-button" onClick={() => { onProductModeChange('simple'); setConfirmSimpleMode(false); }}>{text('Use one price', 'استخدام سعر واحد')}</button>
          </div>
        </div>
      )}
      {!!variants.length && (
        <div className="builder-variant-list">
          <h3>{text('Sellable variants', 'المتغيرات القابلة للبيع')}</h3>
          {variants.map((variant, index) => (
            <section className="builder-group-card builder-variant-card" key={variant.id}>
              <header className="builder-group-header">
                <div className="builder-order-buttons">
                  <button
                    type="button"
                    aria-label={text('Move variant up', 'تحريك المتغير لأعلى')}
                    disabled={index === 0}
                    onClick={() => onMoveVariant(index, -1)}
                  >
                    <Icon name="arrow-up" />
                  </button>
                  <button
                    type="button"
                    aria-label={text('Move variant down', 'تحريك المتغير لأسفل')}
                    disabled={index === variants.length - 1}
                    onClick={() => onMoveVariant(index, 1)}
                  >
                    <Icon name="arrow-down" />
                  </button>
                </div>
                <span className="builder-group-index">{index + 1}</span>
                <div>
                  <strong>{variant.name || text('New variant', 'متغير جديد')}</strong>
                  <small>
                    {variant.availability === 'available'
                      ? text('Available', 'متاح')
                      : text('Unavailable', 'غير متاح')}
                  </small>
                </div>
                <button
                  type="button"
                  className="builder-remove-button"
                  aria-label={`${text('Remove variant', 'حذف المتغير')} ${variant.name}`}
                  onClick={() => onRemoveVariant(variant.id)}
                >
                  <Icon name="close" />
                </button>
              </header>
              <div className="builder-variant-grid">
                <label className="builder-field">
                  <span>
                    {text('Variant name', 'اسم المتغير')} <i>*</i>
                  </span>
                  <input
                    maxLength={160}
                    value={variant.name}
                    onChange={(event) => onVariantChange(variant.id, { name: event.target.value })}
                    placeholder={text('e.g. 500 ml', 'مثال: 500 مل')}
                  />
                </label>
                <label className="builder-field">
                  <span>
                    {text('Variant price (EGP)', 'سعر المتغير (جنيه)')} <i>*</i>
                  </span>
                  <input
                    type="number"
                    lang="en"
                    dir="ltr"
                    min="0.01"
                    step="0.01"
                    value={variant.price}
                    onChange={(event) => onVariantChange(variant.id, { price: event.target.value })}
                  />
                </label>
                <details className="builder-advanced builder-variant-extras">
                  <summary>{text('Optional codes, stock & availability', 'الأكواد والمخزون وحالة التوفر — اختياري')}</summary>
                  <div className="builder-variant-grid">
                <label className="builder-field">
                  <span>{text('SKU (optional)', 'رمز SKU (اختياري)')}</span>
                  <input
                    maxLength={80}
                    value={variant.sku}
                    onChange={(event) => onVariantChange(variant.id, { sku: event.target.value })}
                    placeholder={text('Unique merchant code', 'رمز فريد للمتجر')}
                    dir="ltr"
                  />
                </label>
                <label className="builder-field">
                  <span>{text('Barcode (optional)', 'الباركود (اختياري)')}</span>
                  <input
                    maxLength={80}
                    value={variant.barcode}
                    onChange={(event) =>
                      onVariantChange(variant.id, { barcode: event.target.value })
                    }
                    placeholder={text('Enter a barcode', 'أدخل الباركود')}
                    dir="ltr"
                  />
                </label>
                <label className="builder-field">
                  <span>{text('Stock quantity', 'كمية المخزون')}</span>
                  <input
                    type="number"
                    lang="en"
                    dir="ltr"
                    min="0"
                    step="1"
                    value={variant.stockQuantity}
                    onChange={(event) =>
                      onVariantChange(variant.id, { stockQuantity: event.target.value })
                    }
                    placeholder={text('Blank = not tracked', 'فارغ = بدون تتبع')}
                  />
                </label>
                <label className="builder-field">
                  <span>{text('Variant availability', 'حالة المتغير')}</span>
                  <select
                    value={variant.availability}
                    onChange={(event) =>
                      onVariantChange(variant.id, {
                        availability: event.target.value as VariantDraft['availability'],
                      })
                    }
                  >
                    <option value="available">{text('Available', 'متاح')}</option>
                    <option value="unavailable">{text('Unavailable', 'غير متاح')}</option>
                  </select>
                </label>
                  </div>
                </details>
              </div>
              <div className="builder-attributes">
                <div className="builder-attributes-heading">
                  <div>
                    <strong>{text('Variant attributes', 'خصائص المتغير')}</strong>
                    <small>{text('Add any dimensions, such as Size, Color, or Material.', 'أضف أي خصائص مثل المقاس أو اللون أو الخامة.')}</small>
                  </div>
                  <button type="button" className="builder-button" onClick={() => onAddVariantAttribute(variant.id)}>
                    <Icon name="plus" />
                    {text('Add attribute', 'إضافة خاصية')}
                  </button>
                </div>
                {variant.attributes.map((attribute, attributeIndex) => (
                  <div className="builder-attribute-row" key={`${variant.id}-${attributeIndex}`}>
                    <label className="builder-field">
                      <span>{text('Attribute', 'الخاصية')}</span>
                      <input
                        maxLength={120}
                        value={attribute.name}
                        onChange={(event) => onVariantAttributeChange(variant.id, attributeIndex, { name: event.target.value })}
                        placeholder={text('e.g. Size', 'مثال: المقاس')}
                      />
                    </label>
                    <label className="builder-field">
                      <span>{text('Value', 'القيمة')}</span>
                      <input
                        maxLength={120}
                        value={attribute.value}
                        onChange={(event) => onVariantAttributeChange(variant.id, attributeIndex, { value: event.target.value })}
                        placeholder={text('e.g. Large', 'مثال: كبير')}
                      />
                    </label>
                    <button type="button" className="builder-remove-button" aria-label={text('Remove attribute', 'حذف الخاصية')} onClick={() => onRemoveVariantAttribute(variant.id, attributeIndex)}>
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <section className="builder-group-card builder-group-entry">
        <div className="builder-entry-heading">
          <div>
            <h3>{text('Add customer choices', 'إضافة خيارات للعميل')}</h3>
            <p>{text('Reuse a saved group or create one. Pricing and selection rules stay specific to this product.', 'استخدم مجموعة محفوظة أو أنشئ مجموعة جديدة. يظل السعر وقواعد الاختيار خاصة بهذا المنتج.')}</p>
          </div>
        </div>
        <div className="builder-entry-tabs" role="group" aria-label={text('Choose how to add options', 'اختر طريقة إضافة الخيارات')}>
          <button
            type="button"
            className={groupEntryMode === 'library' ? 'active' : ''}
            aria-pressed={groupEntryMode === 'library'}
            onClick={() => setGroupEntryMode('library')}
          >
            {text('Use saved group', 'استخدام مجموعة محفوظة')}
            <span>{text(String(availableLibraryGroups.length), String(availableLibraryGroups.length))}</span>
          </button>
          <button
            type="button"
            className={groupEntryMode === 'create' ? 'active' : ''}
            aria-pressed={groupEntryMode === 'create'}
            onClick={() => setGroupEntryMode('create')}
          >
            {text('Create new group', 'إنشاء مجموعة جديدة')}
          </button>
        </div>
        {groupEntryMode === 'library' ? (
          <div className="builder-group-entry-content">
            {availableLibraryGroups.length > 0 ? (
              <>
                <label className="builder-field">
                  <span>{text('Reusable group', 'مجموعة محفوظة')}</span>
                  <select
                    value={selectedLibraryGroupId}
                    onChange={(event) => onSelectedLibraryGroupChange(event.target.value)}
                    disabled={libraryLoading || groups.length >= 30}
                  >
                    <option value="">{text('Choose a group', 'اختر مجموعة')}</option>
                    {availableLibraryGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} · {group.assignedProductCount} {text('products', 'منتجات')}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="builder-button primary"
                  onClick={onAddGroupFromLibrary}
                  disabled={!selectedLibraryGroupId || groups.length >= 30 || libraryLoading}
                >
                  <Icon name="plus" />
                  {text('Add to this product', 'إضافة إلى هذا المنتج')}
                </button>
              </>
            ) : (
              <p className="builder-entry-empty" role="status">
                {libraryLoading
                  ? text('Loading saved groups…', 'جارٍ تحميل المجموعات المحفوظة…')
                  : modifierLibrary.length > 0
                    ? text('All saved groups are already added to this product.', 'تمت إضافة كل المجموعات المحفوظة إلى هذا المنتج بالفعل.')
                    : text('No saved groups yet. Create one to reuse it across products.', 'لا توجد مجموعات محفوظة بعد. أنشئ مجموعة لإعادة استخدامها مع منتجات أخرى.')}
              </p>
            )}
          </div>
        ) : (
          <div className="builder-group-entry-content builder-create-fields">
            <label className="builder-field">
              <span>{text('Group name', 'اسم المجموعة')}</span>
              <input
                maxLength={160}
                value={newGroupName}
                onChange={(event) => onNewGroupNameChange(event.target.value)}
                placeholder={text('e.g. Toppings', 'مثال: الإضافات')}
              />
            </label>
            <div className="builder-field builder-new-choices">
              <span>{text('Customer choices', 'خيارات العميل')}</span>
              {newGroupOptions.split(/\r?\n/).map((choice, index, choices) => (
                <div className="builder-new-choice-row" key={index}>
                  <input
                    aria-label={text(`Choice ${index + 1}`, `الخيار ${index + 1}`)}
                    maxLength={160}
                    value={choice}
                    placeholder={text('e.g. Extra cheese', 'مثال: جبنة إضافية')}
                    onChange={(event) => onNewGroupOptionsChange(choices.map((value, choiceIndex) => choiceIndex === index ? event.target.value : value).join('\n'))}
                  />
                  <button
                    type="button"
                    className="builder-remove-button"
                    aria-label={text(`Remove choice ${index + 1}`, `إزالة الخيار ${index + 1}`)}
                    disabled={choices.length === 1}
                    onClick={() => onNewGroupOptionsChange(choices.filter((_, choiceIndex) => choiceIndex !== index).join('\n'))}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="builder-button"
                disabled={newGroupOptions.split(/\r?\n/).length >= 100 || creatingGroup}
                onClick={() => onNewGroupOptionsChange(`${newGroupOptions}\n`)}
              >
                <Icon name="plus" />
                {text('Add another choice', 'إضافة خيار آخر')}
              </button>
            </div>
            <div className="builder-create-actions">
              <small>
                {text(`${newGroupOptionCount} choices`, `${newGroupOptionCount} خيارات`)}
              </small>
              <button
                type="button"
                className="builder-button primary"
                disabled={creatingGroup || !newGroupName.trim() || newGroupOptionCount === 0 || groups.length >= 30}
                onClick={onCreateAndAddGroup}
              >
                <Icon name="plus" />
                {creatingGroup
                  ? text('Creating…', 'جارٍ الإنشاء…')
                  : text('Create and add to product', 'إنشاء وإضافة إلى المنتج')}
              </button>
            </div>
          </div>
        )}
      </section>
      <div className="builder-subsection-heading">
        <div>
          <h3>{text('Choices on this product', 'الخيارات على هذا المنتج')}</h3>
          <p>{text('Adjust selection limits and prices for this product.', 'عدّل حدود الاختيار والأسعار لهذا المنتج.')}</p>
        </div>
        <span className="builder-count-badge">{text(String(groups.length), String(groups.length))}</span>
      </div>
      {!groups.length && (
        <div className="builder-empty-state builder-empty-options">
          <strong>{text('No customer choices added yet', 'لم تتم إضافة خيارات للعميل بعد')}</strong>
          <p>{text('You can continue without add-ons. Add a group only if customers need extra choices.', 'يمكنك المتابعة بدون إضافات. أضف مجموعة فقط إذا احتاج العميل إلى خيارات إضافية.')}</p>
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
                  <Icon name="arrow-up" />
                </button>
                <button
                  type="button"
                  aria-label={text('Move group down', 'تحريك المجموعة لأسفل')}
                  disabled={groupIndex === groups.length - 1}
                  onClick={() => onMoveGroup(groupIndex, 1)}
                >
                  <Icon name="arrow-down" />
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
                <Icon name="close" />
              </button>
            </header>
            <div className="builder-group-fields">
              {group.description && <p className="builder-group-description">{group.description}</p>}
              <label className="builder-required-choice">
                <input
                  type="checkbox"
                  checked={group.minSelections > 0}
                  onChange={(event) => onGroupChange(group.id, { minSelections: event.target.checked ? 1 : 0 })}
                />
                <span>
                  <strong>{text('Customer must choose', 'يجب على العميل الاختيار')}</strong>
                  <small>{text('Turn off to make this group optional.', 'أوقف هذا الخيار لجعل المجموعة اختيارية.')}</small>
                </span>
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
              <details className="builder-advanced builder-limits-details">
                <summary>
                  {text('Selection limits', 'حدود الاختيار')}
                  <span>{text(String(group.minSelections), String(group.minSelections))}–{text(String(group.maxSelections), String(group.maxSelections))}</span>
                </summary>
              <div className="builder-selection-limits">
                <label className="builder-field">
                  <span>{text('Minimum selections', 'أقل عدد للاختيارات')}</span>
                  <input
                    type="number"
                    lang="en"
                    dir="ltr"
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
                    lang="en"
                    dir="ltr"
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
              </details>
            </div>
            <div className="builder-options-heading">
              <strong>{text('Choices', 'الاختيارات')}</strong>
              <span>{text('EGP price adjustment', 'فرق السعر بالجنيه')}</span>
              <span>{text('Default', 'افتراضي')}</span>
            </div>
            <div className="builder-option-list">
              {group.options.map((option, optionIndex) => (
                <div className="builder-option-row" key={option.id}>
                  <span className="builder-option-position" aria-hidden="true">{optionIndex + 1}</span>
                  <span className="builder-option-name">{option.name}</span>
                  <div className="builder-currency-field">
                    <input
                      aria-label={text('Price adjustment in EGP', 'فرق السعر بالجنيه')}
                      type="number"
                      lang="en"
                      dir="ltr"
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
                </div>
              ))}
            </div>
            {group.options.some((option) => option.defaultSelected) && (
              <button
                type="button"
                className="builder-text-button"
                onClick={() => onGroupChange(group.id, {
                  options: group.options.map((option) => ({ ...option, defaultSelected: false })),
                })}
              >
                {text('Clear default choices', 'إلغاء الاختيارات الافتراضية')}
              </button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function PreviewPublishTab({
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
            <img src={image.publicUrl} key={image.id} alt={name || text('Product image', 'صورة المنتج')} />
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
                  <b dir="ltr">EGP {formatNumber(Number(variant.price || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  {variant.stockQuantity !== '' &&
                    ` · ${text('Stock', 'المخزون')}: ${text(variant.stockQuantity, variant.stockQuantity)}`}
                </span>
              ))}
            </div>
          ) : (
            <strong dir="ltr">EGP {formatNumber(Number(basePrice || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          )}
          <small>{text('Sold per piece', 'يباع بالقطعة')}</small>
        </div>
      </div>
      <div className="builder-review-actions" role="group" aria-label={text('Edit product sections', 'تعديل أقسام المنتج')}>
        <button type="button" className="builder-button" onClick={() => onEditStep(0)}>{text('Edit name & price', 'تعديل الاسم والسعر')}</button>
        <button type="button" className="builder-button" onClick={() => onEditStep(1)}>{text('Edit photos & categories', 'تعديل الصور والتصنيفات')}</button>
        <button type="button" className="builder-button" onClick={() => onEditStep(2)}>{text('Edit customer choices', 'تعديل خيارات العميل')}</button>
        <button type="button" className="builder-button" onClick={() => onEditStep(3)}>{text('Edit inventory setup', 'تعديل إعداد المخزون')}</button>
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
            <span className="builder-count-badge">{text(String(groups.length), String(groups.length))}</span>
          </h3>
          {groups.map((group) => (
            <article key={group.id}>
              <strong>{group.name || text('Unnamed group', 'مجموعة بدون اسم')}</strong>
              <small>
                {text(String(group.minSelections), String(group.minSelections))}–{text(String(group.maxSelections), String(group.maxSelections))} {text('choices', 'اختيارات')} ·{' '}
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
          <h3>{text('Customer choices', 'اختيارات العميل')}<span className="builder-count-badge">{text('0', '0')}</span></h3>
          <p className="builder-review-empty">
            {text('No add-ons or extra choices for this product.', 'لا توجد إضافات أو خيارات أخرى لهذا المنتج.')}
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

function ProductPreview({
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
            ? formatNumber(Math.min(...variants.map((variant) => Number(variant.price || 0))), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : formatNumber(Number(basePrice || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      </div>
      {!!variants.length && (
        <div className="preview-selected-options">
          <h3>{text('Variants', 'المتغيرات')}</h3>
          {variants.map((variant) => (
            <div className="preview-option-row" key={variant.id}>
              <span>{variant.name || text('Variant', 'متغير')}</span>
              <span dir="ltr">EGP {formatNumber(Number(variant.price || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
        <strong dir="ltr">EGP {formatNumber(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
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
