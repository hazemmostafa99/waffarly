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
  availability: CatalogAvailability;
  archivedAt: string | null;
  revision: number;
  images: CatalogProductImage[];
  categories: CatalogCategoryReference[];
  createdAt: string;
  updatedAt: string;
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
}

export type CreateCatalogProductRequest = CatalogProductFields;
export type UpdateCatalogProductRequest = Partial<CatalogProductFields> & { revision: number };

export interface CatalogRevisionRequest {
  revision: number;
}
