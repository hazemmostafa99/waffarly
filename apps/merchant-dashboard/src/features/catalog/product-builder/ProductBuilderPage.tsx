import { isPositiveStockQuantity } from '@waffarly/contracts';
import { cacheStockItem } from '../../inventory/stock-unit-options.js';
import { useEffect, useMemo, useState } from 'react';
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
import {
  ProductInventoryTab,
  type ProductInventoryComponentDraft,
  type ProductInventoryTargetDraft,
} from './ProductInventoryTab.js';
import type { OptionDraft, GroupDraft, VariantDraft } from './product-builder.types.js';
import { BasicInformationTab } from './BasicInformationTab.js';
import { ProductDetailsTab } from './ProductDetailsTab.js';
import { OptionsTab } from './OptionsTab.js';
import { PreviewPublishTab } from './PreviewPublishTab.js';
import { ProductPreview } from './ProductPreview.js';

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
  const [configuredStockItemIds, setConfiguredStockItemIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
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
        components: [{ stockItemId: '', unitCode: '', quantity: '1' }],
      },
  );
  const inventoryConfigurationComplete =
    inventoryEnabled &&
    displayedInventoryTargets.length > 0 &&
    displayedInventoryTargets.every((target) => {
      if (
        !target.components.length ||
        (inventoryMode === 'DIRECT' && target.components.length !== 1)
      ) {
        return false;
      }
      return target.components.every(
        (component) =>
          (configuredStockItemIds.has(component.stockItemId) ||
            stockItems.some((item) => item.id === component.stockItemId)) &&
          component.unitCode.length > 0 &&
          isPositiveStockQuantity(component.quantity),
      );
    });
  function defaultAdjustment(variantId?: string) {
    return groups.reduce((sum, group) => {
      if (
        group.variantOverrides?.find((override) => override.variantId === variantId)?.available ===
        false
      )
        return sum;
      return (
        sum +
        group.options.reduce((optionSum, option) => {
          const override = option.variantOverrides?.find((entry) => entry.variantId === variantId);
          return (
            optionSum +
            (option.defaultSelected && override?.available !== false
              ? Number(override?.priceAdjustment ?? option.priceAdjustment ?? 0)
              : 0)
          );
        }, 0)
      );
    }, 0);
  }

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
      setError(
        text(
          'Enter a group name and at least one option.',
          'أدخل اسم المجموعة وخياراً واحداً على الأقل.',
        ),
      );
      return;
    }
    if (optionNames.length > 100) {
      setError(
        text(
          'A group can have up to 100 options.',
          'يمكن أن تحتوي المجموعة على 100 خيار كحد أقصى.',
        ),
      );
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body: CatalogModifierGroupFields = {
        name: newGroupName.trim(),
        options: optionNames.map((option, position) => ({ name: option, position })),
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
      setError(
        cause instanceof Error
          ? cause.message
          : text('Could not create modifier group.', 'تعذر إنشاء مجموعة الخيارات.'),
      );
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
          ? {
              ...variant,
              attributes: variant.attributes.filter((_, index) => index !== attributeIndex),
            }
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
                    text('Name & price', 'الاسم والسعر'),
                    text('Categories & photos', 'التصنيفات والصور'),
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
                  recipe={inventoryEnabled && inventoryMode === 'RECIPE'}
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
                  onStockItemLoaded={(item) =>
                    setStockItems((current) => cacheStockItem(current, item))
                  }
                  targets={displayedInventoryTargets}
                  variants={variants.map((variant) => ({ id: variant.id, name: variant.name }))}
                  onTargetChange={changeInventoryTarget}
                  text={text}
                />
              )}
              {activeTab === 4 && (
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
                    {activeTab === 3
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
            total={
              variants.length
                ? Math.min(
                    ...variants.map(
                      (variant) => Number(variant.price || 0) + defaultAdjustment(variant.id),
                    ),
                  )
                : Number(basePrice || 0) + defaultAdjustment()
            }
            formatNumber={formatNumber}
            text={text}
          />
        </div>
      )}
    </div>
  );
}
