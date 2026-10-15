import { BadRequestException, ConflictException } from '@nestjs/common';
import type {
  CatalogProductModifierGroupAssignmentFields,
  CatalogProductVariantFields,
} from '@waffarly/contracts';
import { MAX_PRODUCT_PRICE, isValidProductPrice } from '../catalog.constants.js';
import type { ProductInput } from './product.types.js';
export function assertModifierConfigurationModes(
  legacyGroups: ProductInput['modifierGroups'],
  assignments: ProductInput['modifierGroupAssignments'],
): void {
  if (legacyGroups !== undefined && assignments !== undefined) {
    throw new BadRequestException(
      'Use either the legacy modifierGroups field or modifierGroupAssignments, not both.',
    );
  }
}

export function assertAssignmentFields(
  assignment: CatalogProductModifierGroupAssignmentFields,
): void {
  if (!['single', 'multiple'].includes(assignment.selectionMode)) {
    throw new BadRequestException('Modifier selection mode is invalid.');
  }
  if (
    !Number.isInteger(assignment.minSelections) ||
    assignment.minSelections < 0 ||
    !Number.isInteger(assignment.maxSelections) ||
    assignment.maxSelections < 1 ||
    assignment.minSelections > assignment.maxSelections ||
    assignment.maxSelections > assignment.options.length ||
    (assignment.selectionMode === 'single' && assignment.maxSelections !== 1)
  ) {
    throw new BadRequestException('Modifier selection bounds are invalid.');
  }
  if (!Number.isInteger(assignment.position) || assignment.position < 0) {
    throw new BadRequestException('Modifier group position must be a non-negative integer.');
  }
  const optionIds = new Set<string>();
  for (const option of assignment.options) {
    if (optionIds.has(option.optionId)) {
      throw new BadRequestException('Modifier options must be unique within a group.');
    }
    optionIds.add(option.optionId);
    if (
      !Number.isInteger(option.maxQuantity ?? 1) ||
      (option.maxQuantity ?? 1) < 1 ||
      (option.maxQuantity ?? 1) > 99
    ) {
      throw new BadRequestException('Option quantity cap must be between 1 and 99.');
    }
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(option.priceAdjustment)) {
      throw new BadRequestException('Modifier price adjustments must be non-negative EGP amounts.');
    }
  }
}

export function normalizeAttributeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function assertVariants(variants: CatalogProductVariantFields[] | undefined): void {
  if (variants === undefined) return;
  if (variants.length > 100)
    throw new BadRequestException('A product can have at most 100 variants.');
  const positions = new Set<number>();
  const skus = new Set<string>();
  const barcodes = new Set<string>();
  const variantIds = new Set<string>();
  for (const variant of variants) {
    if (!variant.name.trim() || variant.name.trim().length > 160) {
      throw new BadRequestException('Variant name must contain between 1 and 160 characters.');
    }
    assertBasePrice(variant.price);
    if (
      !Number.isInteger(variant.position) ||
      variant.position < 0 ||
      positions.has(variant.position)
    ) {
      throw new BadRequestException('Variant positions must be unique non-negative integers.');
    }
    positions.add(variant.position);
    if (variant.id) {
      if (variantIds.has(variant.id)) throw new BadRequestException('Variant IDs must be unique.');
      variantIds.add(variant.id);
    }
    if ((variant.attributes?.length ?? 0) > 10) {
      throw new BadRequestException('A variant can define at most 10 attributes.');
    }
    const attributeNames = new Set<string>();
    for (const attribute of variant.attributes ?? []) {
      const key = normalizeAttributeName(attribute.name);
      if (!key || !attribute.value.trim() || attributeNames.has(key)) {
        throw new BadRequestException(
          'Variant attributes must have unique names and non-empty values.',
        );
      }
      attributeNames.add(key);
    }
    if (
      variant.stockQuantity !== undefined &&
      variant.stockQuantity !== null &&
      (!Number.isInteger(variant.stockQuantity) ||
        variant.stockQuantity < 0 ||
        variant.stockQuantity > 2_147_483_647)
    ) {
      throw new BadRequestException(
        'Variant stock must be a non-negative whole number or untracked.',
      );
    }
    if (!['available', 'unavailable'].includes(variant.availability)) {
      throw new BadRequestException('Variant availability is invalid.');
    }
    const sku = normalizeVariantCode(variant.sku)?.toLocaleLowerCase();
    const barcode = normalizeVariantCode(variant.barcode)?.toLocaleLowerCase();
    if (sku && sku.length > 80) throw new BadRequestException('Variant SKU is too long.');
    if (barcode && barcode.length > 80) {
      throw new BadRequestException('Variant barcode is too long.');
    }
    if (sku && skus.has(sku)) throw new BadRequestException('Variant SKUs must be unique.');
    if (barcode && barcodes.has(barcode)) {
      throw new BadRequestException('Variant barcodes must be unique.');
    }
    if (sku) skus.add(sku);
    if (barcode) barcodes.add(barcode);
  }
}

export function normalizeVariantCode(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLocaleUpperCase();
  return normalized || undefined;
}

export function assertBasePrice(value: string): void {
  if (!isValidProductPrice(value)) {
    throw new BadRequestException(
      `Base price must be between 0.01 and ${MAX_PRODUCT_PRICE} EGP with at most two decimals.`,
    );
  }
}

export function assertPersistedModifierGroup(group: {
  selectionMode: string;
  minSelections: number;
  maxSelections: number;
  options: Array<{ defaultSelected: boolean }>;
}): void {
  const defaults = group.options.filter((option) => option.defaultSelected).length;
  if (
    !['single', 'multiple'].includes(group.selectionMode) ||
    group.minSelections < 0 ||
    group.maxSelections < 1 ||
    group.minSelections > group.maxSelections ||
    group.maxSelections > group.options.length ||
    (group.selectionMode === 'single' && group.maxSelections !== 1) ||
    defaults > group.maxSelections
  ) {
    throw new ConflictException('Product has an invalid modifier configuration.');
  }
}
