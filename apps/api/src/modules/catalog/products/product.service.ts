import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CatalogProductModifierGroupAssignmentFields } from '@waffarly/contracts';
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
import { productInclude, toProductResponse } from './product.mapper.js';
import {
  assertBasePrice,
  assertModifierConfigurationModes,
  assertVariants,
} from './product.rules.js';
import type { ProductInput, ProductPatch } from './product.types.js';
@Injectable()
export class ProductService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(merchantId: string) {
    const products = await this.prisma.product.findMany({
      where: { merchantId },
      include: productInclude,
      orderBy: { createdAt: 'desc' },
    });
    return products.map(toProductResponse);
  }

  async create(merchantId: string, actor: string, input: ProductInput) {
    assertBasePrice(input.basePrice);
    assertVariants(input.variants);
    assertModifierConfigurationModes(input.modifierGroups, input.modifierGroupAssignments);
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
      include: { images: true },
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
            await replaceVariantsWithAttributes(transaction, merchantId, id, input.variants);
          }
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
          const changed = await transaction.product.updateMany({
            where: { id: productId, merchantId, revision, archivedAt: null },
            data: { revision: { increment: 1 }, updatedBy: actor },
          });
          if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
          await createModifierAssignments(transaction, merchantId, productId, [assignment]);
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

  private async get(merchantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, merchantId },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product was not found.');
    return toProductResponse(product);
  }
}
