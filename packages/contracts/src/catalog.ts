export type CatalogAvailability = 'available' | 'unavailable';

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
  archivedAt: string | null;
  revision: number;
  images: CatalogProductImage[];
  categories: CatalogCategoryReference[];
  modifierGroups: CatalogProductModifierGroup[];
  variants: CatalogProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProductModifierOption {
  id: string;
  name: string;
  priceAdjustment: string;
  defaultSelected: boolean;
  position: number;
}

export interface CatalogProductModifierGroup {
  id: string;
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
}

export interface CatalogProductQuoteSelection {
  groupId: string;
  optionIds: string[];
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
  currency: 'EGP';
  basePrice: string;
  modifierTotal: string;
  totalPrice: string;
  selections: Array<{
    groupId: string;
    optionIds: string[];
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
}

export interface CreateStorefrontOrderRequest {
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

export type StorefrontOrderStatus = 'pending' | 'accepted' | 'rejected';

export interface StorefrontOrderReceipt {
  id: string;
  status: StorefrontOrderStatus;
  currency: 'EGP';
  total: string;
  createdAt: string;
}

export interface StorefrontOrderSummary {
  id: string;
  status: StorefrontOrderStatus;
  customerName: string;
  customerPhone: string;
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress: string | null;
  currency: 'EGP';
  total: string;
  createdAt: string;
  lines: Array<{
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    selections: Array<{
      groupName: string;
      optionName: string;
      priceAdjustment: string;
    }>;
  }>;
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
  variants?: CatalogProductVariantFields[] | undefined;
}

export interface CatalogProductVariantFields {
  name: string;
  sku?: string | undefined;
  barcode?: string | undefined;
  price: string;
  stockQuantity?: number | null | undefined;
  availability: CatalogAvailability;
  position: number;
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
