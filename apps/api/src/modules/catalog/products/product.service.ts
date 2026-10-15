import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CatalogProductModifierGroupAssignmentFields } from '@waffarly/contracts';
import type { CursorPage } from '@waffarly/contracts';
import { assertScopedCursor, type CursorPageQuery } from '../../../common/http/pagination.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  createLegacyModifierGroups,
  createModifierAssignments,
  replaceModifierAssignments,
} from './persistence/product-modifiers.persistence.js';
import {
  assertModifierGroupAssignments,
  assertReferences,
  assertVariantIdentifiers,
} from './persistence/product-references.js';
import {
  createVariantsWithAttributes,
  replaceVariantsWithAttributes,
} from './persistence/product-variants.persistence.js';
import { replaceProductInventoryConfiguration } from './persistence/product-inventory.persistence.js';
import {
  replaceModifierDetails,
  assertSavedModifierDetails,
} from './persistence/modifier-details.persistence.js';
import { productInclude, toProductResponse } from './product.mapper.js';
import {
  assertInventoryConfigurationShape,
  inventoryConfigurationMatches,
} from './product-inventory.rules.js';
import {
  assertBasePrice,
  assertModifierConfigurationModes,
  assertVariants,
} from './product.rules.js';
import { assertPendingRecipeUnchanged } from './persistence/pending-recipe.rules.js';
import type { ProductInput, ProductPatch } from './product.types.js';
@Injectable()
export class ProductService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(
    merchantId: string,
    page: CursorPageQuery = { limit: 50 },
  ): Promise<CursorPage<ReturnType<typeof toProductResponse>>> {
    if (page.cursor) {
      const anchor = await this.prisma.product.findFirst({
        where: { id: page.cursor, merchantId },
        select: { id: true },
      });
      assertScopedCursor(page.cursor, anchor !== null);
    }
    const products = await this.prisma.product.findMany({
      where: { merchantId },
      include: productInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const hasMore = products.length > page.limit;
    const items = products.slice(0, page.limit).map(toProductResponse);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async create(merchantId: string, actor: string, input: ProductInput) {
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
    await assertVariantIdentifiers(this.prisma, merchantId, input.variants);
    await assertModifierGroupAssignments(this.prisma, merchantId, input.modifierGroupAssignments);
    const primaryImageAssetId = input.primaryImageAssetId ?? input.imageAssetIds[0];
    if (!primaryImageAssetId) throw new BadRequestException('At least one image is required.');
    await assertReferences(this.prisma, merchantId, input.imageAssetIds, input.categoryIds);
    if (!input.imageAssetIds.includes(primaryImageAssetId)) {
      throw new BadRequestException('Primary image must be one of the product images.');
    }
    try {
      const product = await this.prisma.$transaction(
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

  async update(
    merchantId: string,
    actor: string,
    id: string,
    revision: number,
    input: ProductPatch,
  ) {
    const current = await this.prisma.product.findFirst({
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
      await assertVariantIdentifiers(this.prisma, merchantId, input.variants, id);
    }
    if (input.modifierGroupAssignments !== undefined) {
      await assertModifierGroupAssignments(this.prisma, merchantId, input.modifierGroupAssignments);
    }
    const categoryIds = input.categoryIds;
    await assertReferences(this.prisma, merchantId, imageAssetIds, categoryIds);
    if (!imageAssetIds.includes(primaryImageAssetId)) {
      throw new BadRequestException('Primary image must be one of the product images.');
    }

    const product = await this.prisma
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
            await replaceModifierDetails(
              transaction,
              merchantId,
              id,
              input.modifierGroupAssignments,
            );
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

  async attachModifierGroup(
    merchantId: string,
    actor: string,
    productId: string,
    revision: number,
    assignment: CatalogProductModifierGroupAssignmentFields,
  ) {
    await assertModifierGroupAssignments(this.prisma, merchantId, [assignment]);
    try {
      const product = await this.prisma.$transaction(
        async (transaction) => {
          await assertPendingRecipeUnchanged(transaction, merchantId, productId, {
            modifierGroups: [],
          });
          const changed = await transaction.product.updateMany({
            where: { id: productId, merchantId, revision, archivedAt: null },
            data: { revision: { increment: 1 }, updatedBy: actor },
          });
          if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
          await createModifierAssignments(transaction, merchantId, productId, [assignment]);
          await replaceModifierDetails(transaction, merchantId, productId, [assignment]);
          await assertSavedModifierDetails(transaction, merchantId, productId);
          return transaction.product.findUniqueOrThrow({
            where: { id: productId },
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
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('This modifier group is already assigned to the product.');
      }
      throw error;
    }
  }

  async detachModifierGroup(
    merchantId: string,
    actor: string,
    productId: string,
    assignmentId: string,
    revision: number,
  ) {
    try {
      const product = await this.prisma.$transaction(
        async (transaction) => {
          await assertPendingRecipeUnchanged(transaction, merchantId, productId, {
            modifierGroups: [],
          });
          const changed = await transaction.product.updateMany({
            where: { id: productId, merchantId, revision, archivedAt: null },
            data: { revision: { increment: 1 }, updatedBy: actor },
          });
          if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
          const detached = await transaction.productModifierGroupAssignment.deleteMany({
            where: { id: assignmentId, productId, merchantId },
          });
          if (detached.count !== 1) {
            throw new NotFoundException('Modifier group assignment was not found.');
          }
          return transaction.product.findUniqueOrThrow({
            where: { id: productId },
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

  async archive(merchantId: string, actor: string, id: string, revision: number) {
    const changed = await this.prisma.product.updateMany({
      where: { id, merchantId, revision, archivedAt: null },
      data: { archivedAt: new Date(), updatedBy: actor, revision: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
    return this.get(merchantId, id);
  }

  async restore(merchantId: string, actor: string, id: string, revision: number) {
    const changed = await this.prisma.product.updateMany({
      where: { id, merchantId, revision, archivedAt: { not: null } },
      data: {
        archivedAt: null,
        availability: 'unavailable',
        updatedBy: actor,
        revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
    return this.get(merchantId, id);
  }

  async remove(merchantId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, merchantId } });
    if (!product) throw new NotFoundException('Product was not found.');
    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const orderUse = await transaction.storefrontOrderLine.findFirst({
            where: { merchantId, productId: id },
            select: { id: true },
          });
          if (orderUse) {
            throw new ConflictException(
              'Products used in an order cannot be deleted; archive it instead.',
            );
          }
          await transaction.productImage.deleteMany({ where: { productId: id } });
          await transaction.productCategory.deleteMany({ where: { productId: id } });
          await transaction.product.delete({ where: { id } });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isSerializationConflict(error)) {
        throw new ConflictException('Product has order history and cannot be deleted.');
      }
      throw error;
    }
    return { deleted: true };
  }

  async get(merchantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, merchantId },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product was not found.');
    return toProductResponse(product);
  }
}
