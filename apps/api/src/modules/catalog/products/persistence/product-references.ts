import { BadRequestException, ConflictException } from '@nestjs/common';
import type {
  CatalogProductModifierGroupAssignmentFields,
  CatalogProductVariantFields,
} from '@waffarly/contracts';
import type { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import { MAX_PRODUCT_IMAGES } from '../../catalog.constants.js';
import { assertAssignmentFields, normalizeVariantCode } from '../product.rules.js';
export async function assertReferences(
  prisma: PrismaService,
  merchantId: string,
  imageAssetIds: string[],
  categoryIds: string[] | undefined,
): Promise<void> {
  if (imageAssetIds.length === 0 || imageAssetIds.length > MAX_PRODUCT_IMAGES) {
    throw new BadRequestException(
      `A product must have between 1 and ${MAX_PRODUCT_IMAGES} images.`,
    );
  }
  if (new Set(imageAssetIds).size !== imageAssetIds.length) {
    throw new BadRequestException('Product images must be unique.');
  }
  if (categoryIds !== undefined) {
    if (categoryIds.length === 0 || new Set(categoryIds).size !== categoryIds.length) {
      throw new BadRequestException('At least one unique category is required.');
    }
  }
  const [images, categories] = await Promise.all([
    prisma.mediaAsset.findMany({ where: { merchantId, id: { in: imageAssetIds } } }),
    categoryIds === undefined
      ? Promise.resolve([])
      : prisma.category.findMany({
          where: { merchantId, id: { in: categoryIds }, archivedAt: null },
        }),
  ]);
  if (images.length !== imageAssetIds.length) {
    throw new BadRequestException('Every image must belong to this merchant.');
  }
  if (categoryIds !== undefined && categories.length !== categoryIds.length) {
    throw new BadRequestException('Every category must belong to this merchant.');
  }
}

export async function assertVariantIdentifiers(
  prisma: PrismaService,
  merchantId: string,
  variants: CatalogProductVariantFields[] | undefined,
  excludingProductId?: string,
): Promise<void> {
  if (!variants?.length) return;
  const skus = variants
    .map((variant) => normalizeVariantCode(variant.sku))
    .filter((sku): sku is string => sku !== undefined);
  const barcodes = variants
    .map((variant) => normalizeVariantCode(variant.barcode))
    .filter((barcode): barcode is string => barcode !== undefined);
  if (!skus.length && !barcodes.length) return;

  const identifiers = await prisma.productVariant.findMany({
    where: {
      merchantId,
      ...(excludingProductId ? { productId: { not: excludingProductId } } : {}),
      OR: [
        ...(skus.length ? [{ sku: { in: skus, mode: 'insensitive' as const } }] : []),
        ...(barcodes.length ? [{ barcode: { in: barcodes, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { sku: true, barcode: true },
  });
  const requestedSkus = new Set(skus.map((sku) => sku.toLocaleLowerCase()));
  const requestedBarcodes = new Set(barcodes.map((barcode) => barcode.toLocaleLowerCase()));
  if (
    identifiers.some(
      (variant) =>
        (variant.sku && requestedSkus.has(variant.sku.toLocaleLowerCase())) ||
        (variant.barcode && requestedBarcodes.has(variant.barcode.toLocaleLowerCase())),
    )
  ) {
    throw new ConflictException('Variant SKU and barcode values must be unique per merchant.');
  }
}

export async function assertModifierGroupAssignments(
  prisma: PrismaService,
  merchantId: string,
  assignments: CatalogProductModifierGroupAssignmentFields[] | undefined,
): Promise<void> {
  if (assignments === undefined) return;
  if (assignments.length > 30) {
    throw new BadRequestException('A product can have at most 30 modifier groups.');
  }
  const positions = new Set<number>();
  const groupIds = new Set<string>();
  for (const assignment of assignments) {
    assertAssignmentFields(assignment);
    if (positions.has(assignment.position)) {
      throw new BadRequestException('Modifier group positions must be unique.');
    }
    if (groupIds.has(assignment.modifierGroupId)) {
      throw new BadRequestException('A modifier group can only be assigned once to a product.');
    }
    positions.add(assignment.position);
    groupIds.add(assignment.modifierGroupId);
  }
  if (groupIds.size === 0) return;
  const groups = await prisma.modifierGroup.findMany({
    where: { merchantId, id: { in: [...groupIds] } },
    select: { id: true, options: { select: { id: true } } },
  });
  if (groups.length !== groupIds.size) {
    throw new BadRequestException('Every modifier group must belong to this merchant.');
  }
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const assignment of assignments) {
    const group = byId.get(assignment.modifierGroupId);
    if (!group) throw new BadRequestException('Modifier group was not found.');
    const allowedOptionIds = new Set(group.options.map((option) => option.id));
    const requestedOptionIds = assignment.options.map((option) => option.optionId);
    if (
      new Set(requestedOptionIds).size !== requestedOptionIds.length ||
      requestedOptionIds.length !== allowedOptionIds.size ||
      requestedOptionIds.some((optionId) => !allowedOptionIds.has(optionId))
    ) {
      throw new BadRequestException(
        'Assignment configuration must include every option from the modifier group exactly once.',
      );
    }
    if (
      assignment.options.filter((option) => option.defaultSelected).length >
      assignment.maxSelections
    ) {
      throw new BadRequestException('Default selections cannot exceed the group selection limit.');
    }
  }
}
