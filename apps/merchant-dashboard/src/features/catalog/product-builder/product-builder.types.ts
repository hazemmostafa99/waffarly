import type {
  CatalogModifierEffectFields,
  CatalogModifierOptionVariantFields,
  CatalogModifierGroupVariantFields,
} from '@waffarly/contracts';
export type OptionDraft = {
  maxQuantity?: number | undefined;
  effects?: CatalogModifierEffectFields[] | undefined;
  variantOverrides?: CatalogModifierOptionVariantFields[] | undefined;
  id: string;
  name: string;
  priceAdjustment: string;
  defaultSelected: boolean;
};

export type ChoiceGroupDraft = {
  variantOverrides?: CatalogModifierGroupVariantFields[] | undefined;
  name: string;
  selectionMode: 'single' | 'multiple';
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: OptionDraft[];
};

export type GroupDraft = {
  variantOverrides?: CatalogModifierGroupVariantFields[] | undefined;
  id: string;
  modifierGroupId: string;
  name: string;
  description: string;
  selectionMode: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  options: OptionDraft[];
};

export type VariantDraft = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: string;
  stockQuantity: string;
  availability: 'available' | 'unavailable';
  attributes: Array<{ attributeId?: string; valueId?: string; name: string; value: string }>;
};
