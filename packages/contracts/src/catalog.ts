import type { CursorPage } from './pagination.js';

export type CatalogAvailability = 'available' | 'unavailable';
export type ProductInventoryMode = 'DIRECT' | 'RECIPE';

export interface CatalogProductInventoryComponentFields {
  stockItemId: string;
  unitCode: string;
  quantity: string;
}

export interface CatalogProductInventoryTargetFields {
  variantId: string | null;
  components: CatalogProductInventoryComponentFields[];
}

export interface CatalogProductInventoryConfigurationFields {
  mode: ProductInventoryMode;
  targets: CatalogProductInventoryTargetFields[];
}

export interface CatalogProductInventoryComponent extends CatalogProductInventoryComponentFields {
  id: string;
  stockItemName: string;
  stockItemBaseUnit: string;
  unitCode: string;
  unitName: string;
  baseQuantity: string;
  position: number;
}

export interface CatalogProductInventoryTarget {
  id: string;
  variantId: string | null;
  components: CatalogProductInventoryComponent[];
}

export interface CatalogProductInventoryConfiguration {
  mode: ProductInventoryMode;
  targets: CatalogProductInventoryTarget[];
  updatedAt: string;
}

export interface CatalogMediaAsset {
  id: string;
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface CatalogCategoryReference {
  id: string;
  name: string;
  parentId: string | null;
  availability: CatalogAvailability;
}

export interface CatalogCategorySummary {
  id: string;
  name: string;
  description: string | null;
  image: Pick<CatalogMediaAsset, 'id' | 'publicUrl' | 'mimeType' | 'sizeBytes'>;
  parentId: string | null;
  parent: {
    id: string;
    name: string;
    availability: CatalogAvailability;
    archivedAt: string | null;
  } | null;
  availability: CatalogAvailability;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  childCount: number;
  productCount: number;
  effectiveVisible: boolean;
}

export interface CatalogProductImage {
  id: string;
  mediaAssetId: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  isPrimary: boolean;
  position: number;
}

export interface CatalogProductSummary {
  id: string;
  name: string;
  description: string | null;
  basePrice: string;
  currency: 'EGP';
  sellingUnit: 'piece';
  availability: CatalogAvailability;
  inventoryConfigurationRequired: boolean;
  inventoryDefaultMode: ProductInventoryMode;
  inventoryConfiguration: CatalogProductInventoryConfiguration | null;
  archivedAt: string | null;
  revision: number;
  images: CatalogProductImage[];
  categories: CatalogCategoryReference[];
  modifierGroups: CatalogProductModifierGroup[];
  variants: CatalogProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogModifierEffectFields {
  stockItemId: string;
  direction: 'ADD' | 'REMOVE';
  unitCode: string;
  quantity: string;
}

export interface CatalogModifierOptionVariantFields {
  variantId: string;
  available: boolean;
  priceAdjustment?: string | undefined;
  /** Absent inherits; [] explicitly removes every default effect. */
  effects?: CatalogModifierEffectFields[] | undefined;
}

export interface CatalogModifierGroupVariantFields {
  variantId: string;
  available: boolean;
}

export interface CatalogProductModifierOption {
  maxQuantity?: number;
  variantOverrides?: CatalogModifierOptionVariantFields[];
  effects?: CatalogModifierEffectFields[];
  id: string;
  name: string;
  priceAdjustment: string;
  defaultSelected: boolean;
  position: number;
}

export interface CatalogProductModifierGroup {
  variantOverrides?: CatalogModifierGroupVariantFields[];
  /** Product-specific assignment identity used when quoting selections. */
  id: string;
  /** Shared merchant-owned modifier-group identity. */
  modifierGroupId: string;
  name: string;
  description: string | null;
  selectionMode: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  position: number;
  options: CatalogProductModifierOption[];
}

export interface CatalogProductVariant {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  stockQuantity: number | null;
  availability: CatalogAvailability;
  position: number;
  attributes: CatalogProductVariantAttributeSelection[];
}

export interface CatalogProductVariantAttributeSelection {
  attributeId: string;
  attributeName: string;
  valueId: string;
  value: string;
  position: number;
}

export interface CatalogProductVariantAttributeSnapshot {
  attributeId: string | null;
  valueId: string | null;
  attributeName: string;
  attributeValue: string;
  position: number;
}

export interface CatalogProductModifierGroupAssignmentFields {
  variantOverrides?: CatalogModifierGroupVariantFields[] | undefined;
  modifierGroupId: string;
  selectionMode: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  position: number;
  options: Array<{
    optionId: string;
    maxQuantity?: number | undefined;
    variantOverrides?: CatalogModifierOptionVariantFields[] | undefined;
    effects?: CatalogModifierEffectFields[] | undefined;
    priceAdjustment: string;
    defaultSelected: boolean;
  }>;
}

export interface CatalogModifierGroupOption {
  id: string;
  name: string;
  position: number;
}

export interface CatalogModifierGroupSummary {
  id: string;
  name: string;
  description: string | null;
  options: CatalogModifierGroupOption[];
  assignedProductCount: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogModifierGroupFields {
  name: string;
  description?: string | undefined;
  options: Array<{ name: string; position: number }>;
}

export type CreateCatalogModifierGroupRequest = CatalogModifierGroupFields;
export interface UpdateCatalogModifierGroupRequest {
  name?: string | undefined;
  description?: string | undefined;
  options?: CatalogModifierGroupFields['options'] | undefined;
  revision: number;
}

export interface CatalogProductQuoteSelection {
  groupId: string;
  optionIds: string[];
  /** Optional per-ID quantities; omitted IDs mean quantity one. */
  optionQuantities?: Array<{ optionId: string; quantity: number }> | undefined;
}

export interface CatalogProductQuoteRequest {
  variantId?: string | undefined;
  selections?: CatalogProductQuoteSelection[] | undefined;
}

export interface CatalogProductQuoteResponse {
  productId: string;
  productRevision: number;
  variantId: string | null;
  variantName: string | null;
  variantAttributes: CatalogProductVariantAttributeSelection[];
  currency: 'EGP';
  basePrice: string;
  modifierTotal: string;
  totalPrice: string;
  selections: Array<{
    groupId: string;
    modifierGroupId: string;
    optionIds: string[];
    options?: Array<{ optionId: string; quantity: number; unitPriceAdjustment: string }>;
    priceAdjustment: string;
  }>;
}

export interface PublicStorefrontCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface PublicStorefrontProduct {
  id: string;
  name: string;
  description: string | null;
  basePrice: string;
  currency: 'EGP';
  sellingUnit: 'piece';
  images: Array<Pick<CatalogProductImage, 'publicUrl' | 'isPrimary' | 'position'>>;
  categories: Array<Pick<PublicStorefrontCategory, 'id' | 'name'>>;
  modifierGroups: CatalogProductModifierGroup[];
  variants: Array<{
    id: string;
    name: string;
    price: string;
    availability: CatalogAvailability;
    position: number;
    attributes: CatalogProductVariantAttributeSelection[];
  }>;
}

export interface PublicStorefrontCatalog {
  slug: string;
  merchantName: string;
  activity: string;
  accentColor: string;
  logoData: string | null;
  template: { name: string; layout: 'menu' | 'hero' } | null;
  categories: PublicStorefrontCategory[];
  products: PublicStorefrontProduct[];
  nextCategoryCursor: string | null;
  nextProductCursor: string | null;
}

/** Merchant-scoped, read-only catalog projection for authenticated POS employees. */
export interface PosSellableCatalog {
  categories: CursorPage<PublicStorefrontCategory>;
  products: CursorPage<PublicStorefrontProduct>;
}

export interface CreateStorefrontOrderRequest {
  requestId?: string | undefined;
  reviewedTotal?: string | undefined;
  deliveryAreaId?: string | undefined;
  restaurantSettingsRevision?: number | undefined;
  customerName: string;
  customerPhone: string;
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress?: string | undefined;
  items: Array<{
    productId: string;
    variantId?: string | undefined;
    selections: CatalogProductQuoteSelection[];
    quantity: number;
  }>;
}

export type StorefrontOrderStatus =
  'pending' | 'accepted' | 'rejected' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface AcceptRecipeOrderRequest {
  requestId: string;
  branchId: string;
}
export interface StartOrderPreparationRequest {
  requestId: string;
}
export interface MarkOrderReadyRequest {
  requestId: string;
}
export interface MarkKitchenItemReadyRequest {
  requestId: string;
}
export interface HandoverPosOrderRequest {
  requestId: string;
}
export interface CancelRecipeOrderRequest {
  requestId: string;
  restoreStock: boolean;
  reason: string;
}

export interface DispatchPosKitchenOrderRequest {
  requestId: string;
}

export type PosKitchenDispatchMode = 'automatic' | 'manual' | 'legacy';

export interface StorefrontOrderReceipt {
  subtotal?: string;
  deliveryFee?: string;
  id: string;
  status: StorefrontOrderStatus;
  currency: 'EGP';
  total: string;
  createdAt: string;
}

export interface StorefrontOrderSummary {
  subtotal?: string;
  deliveryFee?: string;
  orderReference?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
  handoverEligible?: boolean;
  kitchenTicket?: {
    id: string;
    station: { id: string; name: string };
    dispatchMode: PosKitchenDispatchMode;
    dispatchedAt: string;
    cancellationAcknowledgedAt?: string | null;
  } | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  tableCode?: string | null;
  requiresRecipeAcceptance?: boolean;
  inventoryLifecycle?: {
    branchId: string | null;
    warehouseId: string | null;
    branchName: string | null;
    warehouseName: string | null;
    acceptedAt: string | null;
    preparationStartedAt: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
    stockRestored: boolean | null;
  };
  id: string;
  status: StorefrontOrderStatus;
  customerName: string | null;
  customerPhone: string | null;
  fulfillmentType: 'pickup' | 'delivery' | 'dine_in' | 'takeaway';
  deliveryAddress: string | null;
  currency: 'EGP';
  total: string;
  createdAt: string;
  lines: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    variantAttributes: CatalogProductVariantAttributeSnapshot[];
    basePrice: string | null;
    modifierTotal: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    note?: string | null;
    kitchenReadyAt?: string | null;
    selections: Array<{
      groupName: string;
      optionName: string;
      quantity?: number;
      modifierGroupId: string | null;
      modifierOptionId: string | null;
      priceAdjustment: string;
    }>;
  }>;
}

export interface ProductConfigurationReport {
  from: string;
  to: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: string;
    variants: Array<{
      variantId: string | null;
      variantName: string | null;
      quantity: number;
      revenue: string;
    }>;
  }>;
  attributeValues: Array<{
    attributeId: string | null;
    valueId: string | null;
    attributeName: string;
    attributeValue: string;
    quantity: number;
    revenue: string;
  }>;
  modifierOptions: Array<{
    modifierGroupId: string | null;
    modifierOptionId: string | null;
    groupName: string;
    optionName: string;
    selectedQuantity: number;
    additionalRevenue: string;
  }>;
  legacy: {
    linesWithoutPriceBreakdown: number;
    attributeSnapshotsWithoutIds: number;
    modifierSelectionsWithoutIds: number;
  };
}

export interface UpdateStorefrontOrderStatusRequest {
  status: Extract<StorefrontOrderStatus, 'accepted' | 'rejected'>;
}

export interface RegisterCatalogMediaRequest {
  storageKey: string;
  publicUrl: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
}

export interface CatalogCategoryFields {
  name: string;
  description?: string | undefined;
  imageAssetId: string;
  parentId?: string | null | undefined;
  availability: CatalogAvailability;
}

export type CreateCatalogCategoryRequest = CatalogCategoryFields;
export type UpdateCatalogCategoryRequest = Partial<CatalogCategoryFields> & { revision: number };

export interface CatalogProductFields {
  name: string;
  description?: string | undefined;
  basePrice: string;
  availability: CatalogAvailability;
  imageAssetIds: string[];
  primaryImageAssetId?: string | undefined;
  categoryIds: string[];
  modifierGroups?: CatalogProductModifierGroupFields[] | undefined;
  modifierGroupAssignments?: CatalogProductModifierGroupAssignmentFields[] | undefined;
  variants?: CatalogProductVariantFields[] | undefined;
  inventoryConfiguration?: CatalogProductInventoryConfigurationFields | null | undefined;
}

export interface CatalogProductVariantFields {
  id?: string | undefined;
  name: string;
  sku?: string | undefined;
  barcode?: string | undefined;
  price: string;
  stockQuantity?: number | null | undefined;
  availability: CatalogAvailability;
  position: number;
  attributes?:
    | Array<{
        attributeId?: string | undefined;
        valueId?: string | undefined;
        name: string;
        value: string;
      }>
    | undefined;
}

export interface CatalogProductModifierOptionFields {
  name: string;
  priceAdjustment: string;
  defaultSelected: boolean;
  position: number;
}

export interface CatalogProductModifierGroupFields {
  name: string;
  description?: string | undefined;
  selectionMode: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  position: number;
  options: CatalogProductModifierOptionFields[];
}

export type CreateCatalogProductRequest = CatalogProductFields;
export type UpdateCatalogProductRequest = Partial<CatalogProductFields> & { revision: number };

export interface CatalogRevisionRequest {
  revision: number;
}

export type StorefrontCheckoutQuoteRequest = Pick<CreateStorefrontOrderRequest, 'items' | 'fulfillmentType' | 'deliveryAreaId'>;
export interface StorefrontCheckoutQuote {
  unitPrices: string[];
  subtotal: string; deliveryFee: string; total: string; currency: 'EGP';
  restaurantSettingsRevision?: number | undefined; demo: boolean;
}
