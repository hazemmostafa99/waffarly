/** Creates a product with its images, categories, choices, variants and inventory configuration. */
import { BadRequestException, ConflictException } from '@nestjs/common';

import { isSerializationConflict } from '../../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import {
  createLegacyModifierGroups,
  createModifierAssignments,
} from '../persistence/product-modifiers.persistence.js';
import {
  assertModifierGroupAssignments,
  assertReferences,
  assertVariantIdentifiers,
} from '../persistence/product-references.js';
import { createVariantsWithAttributes } from '../persistence/product-variants.persistence.js';
import { replaceProductInventoryConfiguration } from '../persistence/product-inventory.persistence.js';
import {
  replaceModifierDetails,
  assertSavedModifierDetails,
} from '../persistence/modifier-details.persistence.js';
import { productInclude, toProductResponse } from '../product.mapper.js';
import { assertInventoryConfigurationShape } from '../product-inventory.rules.js';
import {
  assertBasePrice,
  assertModifierConfigurationModes,
  assertVariants,
} from '../product.rules.js';

import type { ProductInput } from '../product.types.js';

export async function createProduct(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  input: ProductInput,
) {
  assertBasePrice(input.basePrice);
  assertVariants(input.variants);
  assertModifierConfigurationModes(input.modifierGroups, input.modifierGroupAssignments);
  if (input.availability === 'available' && !input.inventoryConfiguration) {
    throw new BadRequestException('Configure inventory before making a new product available.');
  }
  if (input.inventoryConfiguration) {
    assertInventoryConfigurationShape(input.inventoryConfiguration);
    if (input.variants?.some((variant) => !variant.id)) {
      throw new BadRequestException('Variant IDs are required when inventory is configured.');
    }
  }
  await assertVariantIdentifiers(prisma, merchantId, input.variants);
  await assertModifierGroupAssignments(prisma, merchantId, input.modifierGroupAssignments);
  const primaryImageAssetId = input.primaryImageAssetId ?? input.imageAssetIds[0];
  if (!primaryImageAssetId) throw new BadRequestException('At least one image is required.');
  await assertReferences(prisma, merchantId, input.imageAssetIds, input.categoryIds);
  if (!input.imageAssetIds.includes(primaryImageAssetId)) {
    throw new BadRequestException('Primary image must be one of the product images.');
  }
  try {
    const product = await prisma.$transaction(
      async (transaction) => {
        const created = await transaction.product.create({
          data: {
            merchant: { connect: { id: merchantId } },
            name: input.name.trim(),
            description: input.description?.trim() || null,
            basePrice: input.basePrice,
            availability: input.availability,
            createdBy: actor,
            updatedBy: actor,
            inventoryConfigurationRequired: true,
            images: {
              create: input.imageAssetIds.map((mediaAssetId, position) => ({
                position,
                isPrimary: mediaAssetId === primaryImageAssetId,
                mediaAsset: {
                  connect: { id_merchantId: { id: mediaAssetId, merchantId } },
                },
              })),
            },
            categoryLinks: {
              create: input.categoryIds.map((categoryId) => ({
                category: {
                  connect: { id_merchantId: { id: categoryId, merchantId } },
                },
              })),
            },
          },
          select: { id: true },
        });
        if (input.modifierGroups?.length) {
          await createLegacyModifierGroups(
            transaction,
            merchantId,
            created.id,
            input.modifierGroups,
          );
        }
        if (input.modifierGroupAssignments?.length) {
          await createModifierAssignments(
            transaction,
            merchantId,
            created.id,
            input.modifierGroupAssignments,
          );
        }
        await createVariantsWithAttributes(
          transaction,
          merchantId,
          created.id,
          input.variants ?? [],
        );
        if (input.inventoryConfiguration) {
          await replaceProductInventoryConfiguration(
            transaction,
            merchantId,
            created.id,
            input.inventoryConfiguration,
          );
        }
        if (input.modifierGroupAssignments?.length)
          await replaceModifierDetails(
            transaction,
            merchantId,
            created.id,
            input.modifierGroupAssignments,
          );
        if (input.modifierGroupAssignments?.length)
          await assertSavedModifierDetails(transaction, merchantId, created.id);
        return transaction.product.findUniqueOrThrow({
          where: { id: created.id },
          include: productInclude,
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return toProductResponse(product);
  } catch (error) {
    if (isSerializationConflict(error)) {
      throw new ConflictException('Product configuration changed concurrently. Please retry.');
    }
    throw error;
  }
}
