/** Updates a product while protecting its revision, saved order history and inventory configuration. */
import { BadRequestException, ConflictException } from '@nestjs/common';

import { isSerializationConflict } from '../../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import {
  createLegacyModifierGroups,
  replaceModifierAssignments,
} from '../persistence/product-modifiers.persistence.js';
import {
  assertModifierGroupAssignments,
  assertReferences,
  assertVariantIdentifiers,
} from '../persistence/product-references.js';
import { replaceVariantsWithAttributes } from '../persistence/product-variants.persistence.js';
import { replaceProductInventoryConfiguration } from '../persistence/product-inventory.persistence.js';
import {
  replaceModifierDetails,
  assertSavedModifierDetails,
} from '../persistence/modifier-details.persistence.js';
import { productInclude, toProductResponse } from '../product.mapper.js';
import {
  assertInventoryConfigurationShape,
  inventoryConfigurationMatches,
} from '../product-inventory.rules.js';
import {
  assertBasePrice,
  assertModifierConfigurationModes,
  assertVariants,
} from '../product.rules.js';
import { assertPendingRecipeUnchanged } from '../persistence/pending-recipe.rules.js';
import type { ProductPatch } from '../product.types.js';

export async function updateProduct(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  id: string,
  revision: number,
  input: ProductPatch,
) {
  // 1. Read the version the owner reviewed before replacing product details.
  const current = await prisma.product.findFirst({
    where: { id, merchantId, revision },
    include: {
      images: true,
      inventoryConfiguration: {
        include: {
          targets: {
            include: {
              components: { select: { stockItemId: true, unitCode: true, quantity: true } },
            },
          },
        },
      },
    },
  });
  if (!current) throw new ConflictException('Product is missing or stale.');
  const imageAssetIds = input.imageAssetIds ?? current.images.map((image) => image.mediaAssetId);
  const primaryImageAssetId =
    input.primaryImageAssetId ??
    current.images.find((image) => image.isPrimary && imageAssetIds.includes(image.mediaAssetId))
      ?.mediaAssetId ??
    imageAssetIds[0];
  if (!primaryImageAssetId) throw new BadRequestException('At least one image is required.');
  if (input.basePrice !== undefined) assertBasePrice(input.basePrice);
  assertVariants(input.variants);
  assertModifierConfigurationModes(input.modifierGroups, input.modifierGroupAssignments);
  if (input.inventoryConfiguration) {
    assertInventoryConfigurationShape(input.inventoryConfiguration);
    if (input.variants?.some((variant) => !variant.id)) {
      throw new BadRequestException('Variant IDs are required when inventory is configured.');
    }
  }
  const nextAvailability = input.availability ?? current.availability;
  const hasConfigurationAfterUpdate =
    input.inventoryConfiguration === undefined
      ? current.inventoryConfiguration !== null
      : input.inventoryConfiguration !== null;
  if (
    nextAvailability === 'available' &&
    current.inventoryConfigurationRequired &&
    !hasConfigurationAfterUpdate
  ) {
    throw new BadRequestException('Configure inventory before making this product available.');
  }
  if (
    input.inventoryConfiguration === null &&
    nextAvailability === 'available' &&
    current.inventoryConfiguration
  ) {
    throw new BadRequestException(
      'A configured product must stay unavailable while inventory is removed.',
    );
  }
  if (
    input.variants !== undefined &&
    current.inventoryConfiguration &&
    input.inventoryConfiguration === undefined
  ) {
    throw new BadRequestException('Update inventory targets together with the product variants.');
  }
  const inventoryConfigurationChanged =
    input.inventoryConfiguration !== undefined &&
    (input.inventoryConfiguration === null
      ? current.inventoryConfiguration !== null
      : !inventoryConfigurationMatches(
          input.inventoryConfiguration,
          current.inventoryConfiguration && {
            mode: current.inventoryConfiguration.mode,
            targets: current.inventoryConfiguration.targets.map((target) => ({
              variantId: target.variantId,
              components: target.components.map((component) => ({
                stockItemId: component.stockItemId,
                unitCode: component.unitCode,
                quantity: component.quantity.toFixed(6),
              })),
            })),
          },
        ));
  if (input.variants !== undefined) {
    await assertVariantIdentifiers(prisma, merchantId, input.variants, id);
  }
  if (input.modifierGroupAssignments !== undefined) {
    await assertModifierGroupAssignments(prisma, merchantId, input.modifierGroupAssignments);
  }
  const categoryIds = input.categoryIds;
  await assertReferences(prisma, merchantId, imageAssetIds, categoryIds);
  if (!imageAssetIds.includes(primaryImageAssetId)) {
    throw new BadRequestException('Primary image must be one of the product images.');
  }

  const product = await prisma
    .$transaction(
      async (transaction) => {
        if (
          input.variants !== undefined ||
          input.inventoryConfiguration !== undefined ||
          input.modifierGroupAssignments !== undefined ||
          input.modifierGroups !== undefined
        )
          await assertPendingRecipeUnchanged(transaction, merchantId, id, input);
        const changed = await transaction.product.updateMany({
          where: { id, merchantId, revision },
          data: {
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
            ...(input.description === undefined
              ? {}
              : { description: input.description.trim() || null }),
            ...(input.basePrice === undefined ? {} : { basePrice: input.basePrice }),
            ...(input.availability === undefined ? {} : { availability: input.availability }),
            updatedBy: actor,
            revision: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
        if (input.imageAssetIds !== undefined || input.primaryImageAssetId !== undefined) {
          await transaction.productImage.deleteMany({ where: { productId: id } });
          await transaction.productImage.createMany({
            data: imageAssetIds.map((mediaAssetId, position) => ({
              productId: id,
              merchantId,
              mediaAssetId,
              position,
              isPrimary: mediaAssetId === primaryImageAssetId,
            })),
          });
        }
        if (categoryIds !== undefined) {
          await transaction.productCategory.deleteMany({ where: { productId: id } });
          await transaction.productCategory.createMany({
            data: categoryIds.map((categoryId) => ({ productId: id, categoryId, merchantId })),
          });
        }
        if (input.modifierGroups !== undefined || input.modifierGroupAssignments !== undefined) {
          if (input.modifierGroups?.length) {
            await transaction.productModifierGroupAssignment.deleteMany({
              where: { productId: id, merchantId },
            });
            await createLegacyModifierGroups(transaction, merchantId, id, input.modifierGroups);
          } else if (input.modifierGroups !== undefined) {
            await transaction.productModifierGroupAssignment.deleteMany({
              where: { productId: id, merchantId },
            });
          } else if (input.modifierGroupAssignments !== undefined) {
            await replaceModifierAssignments(
              transaction,
              merchantId,
              id,
              input.modifierGroupAssignments,
            );
          }
        }
        if (input.inventoryConfiguration !== undefined && inventoryConfigurationChanged) {
          const pendingReservation = await transaction.storefrontOrderLine.findFirst({
            where: {
              merchantId,
              productId: id,
              stockReserved: true,
              order: { is: { status: 'pending' } },
            },
            select: { id: true },
          });
          if (pendingReservation) {
            throw new ConflictException(
              'Inventory configuration cannot change while a pending order holds a stock reservation.',
            );
          }
          await transaction.productInventoryConfiguration.deleteMany({
            where: { productId: id, merchantId },
          });
        }
        if (input.variants !== undefined) {
          const pendingReservation = await transaction.storefrontOrderLine.findFirst({
            where: {
              merchantId,
              productId: id,
              stockReserved: true,
              order: { is: { status: 'pending' } },
            },
            select: { id: true },
          });
          if (pendingReservation) {
            throw new ConflictException(
              'Variants cannot be changed while a pending order holds a stock reservation.',
            );
          }
          await replaceVariantsWithAttributes(
            transaction,
            merchantId,
            id,
            input.variants,
            new Set(
              input.inventoryConfiguration?.targets
                .map((target) => target.variantId)
                .filter((variantId): variantId is string => variantId !== null) ?? [],
            ),
          );
        }
        if (input.inventoryConfiguration && inventoryConfigurationChanged) {
          await replaceProductInventoryConfiguration(
            transaction,
            merchantId,
            id,
            input.inventoryConfiguration,
          );
        }
        if (input.modifierGroupAssignments?.length)
          await replaceModifierDetails(transaction, merchantId, id, input.modifierGroupAssignments);
        if (
          input.modifierGroupAssignments !== undefined ||
          input.variants !== undefined ||
          input.inventoryConfiguration !== undefined
        )
          await assertSavedModifierDetails(transaction, merchantId, id);
        return transaction.product.findUniqueOrThrow({ where: { id }, include: productInclude });
      },
      { isolationLevel: 'Serializable' },
    )
    .catch((error: unknown) => {
      if (isSerializationConflict(error)) {
        throw new ConflictException('Product configuration changed concurrently. Please retry.');
      }
      throw error;
    });
  return toProductResponse(product);
}
