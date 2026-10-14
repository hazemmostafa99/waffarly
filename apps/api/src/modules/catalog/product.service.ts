import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CatalogProductFields,
  CatalogProductModifierGroupAssignmentFields,
  CatalogProductQuoteResponse,
  CatalogProductQuoteSelection,
  CatalogProductVariantFields,
  PublicStorefrontCatalog,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { MAX_PRODUCT_IMAGES, MAX_PRODUCT_PRICE, isValidProductPrice } from './catalog.constants.js';

export type ProductInput = CatalogProductFields;
type ProductPatch = { [Key in keyof ProductInput]?: ProductInput[Key] | undefined };

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

  async getPublicStorefrontCatalog(slug: string): Promise<PublicStorefrontCatalog> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: {
        id: true,
        name: true,
        activity: true,
        storefrontSlug: true,
        storefront: {
          select: {
            accentColor: true,
            logoData: true,
            template: { select: { name: true, layout: true } },
          },
        },
      },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');

    const [categoryRecords, products] = await Promise.all([
      this.prisma.category.findMany({
        where: { merchantId: merchant.id },
        select: {
          id: true,
          name: true,
          parentId: true,
          availability: true,
          archivedAt: true,
          parent: { select: { availability: true, archivedAt: true } },
        },
        orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.product.findMany({
        where: { merchantId: merchant.id, availability: 'available', archivedAt: null },
        include: productInclude,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const visibleCategories = categoryRecords.filter(
      (category) =>
        category.availability === 'available' &&
        category.archivedAt === null &&
        (!category.parent ||
          (category.parent.availability === 'available' && category.parent.archivedAt === null)),
    );
    const visibleCategoryIds = new Set(visibleCategories.map((category) => category.id));

    return {
      slug: merchant.storefrontSlug,
      merchantName: merchant.name,
      activity: merchant.activity,
      accentColor: merchant.storefront?.accentColor ?? '#315b43',
      logoData: merchant.storefront?.logoData ?? null,
      template: merchant.storefront?.template
        ? {
            name: merchant.storefront.template.name,
            layout: merchant.storefront.template.layout as 'menu' | 'hero',
          }
        : null,
      categories: visibleCategories.map(({ id, name, parentId }) => ({ id, name, parentId })),
      products: products
        .filter(
          (product) =>
            product.categoryLinks.length === 0 ||
            product.categoryLinks.some((link) => visibleCategoryIds.has(link.category.id)),
        )
        .map((product) => {
          const publicProduct = toProductResponse(product);
          return {
            id: publicProduct.id,
            name: publicProduct.name,
            description: publicProduct.description,
            basePrice: publicProduct.basePrice,
            currency: 'EGP' as const,
            sellingUnit: 'piece' as const,
            images: publicProduct.images.map(({ publicUrl, isPrimary, position }) => ({
              publicUrl,
              isPrimary,
              position,
            })),
            categories: publicProduct.categories
              .filter((category) => visibleCategoryIds.has(category.id))
              .map(({ id, name }) => ({ id, name })),
            modifierGroups: publicProduct.modifierGroups.map((group) => ({
              ...group,
              selectionMode: group.selectionMode as 'single' | 'multiple',
            })),
            variants: publicProduct.variants.map(
              ({ id, name, price, availability, position, stockQuantity, attributes }) => ({
                id,
                name,
                price,
                availability:
                  availability === 'available' && stockQuantity !== 0 ? 'available' : 'unavailable',
                position,
                attributes,
              }),
            ),
          };
        }),
    };
  }

  async quote(
    id: string,
    selections: CatalogProductQuoteSelection[] = [],
    variantId?: string,
    storefrontSlug?: string,
  ): Promise<CatalogProductQuoteResponse> {
    const merchant = storefrontSlug
      ? await this.prisma.merchant.findUnique({
          where: { storefrontSlug },
          select: { id: true },
        })
      : null;
    if (storefrontSlug && !merchant) throw new NotFoundException('Storefront was not found.');
    const product = await this.prisma.product.findFirst({
      where: { id, archivedAt: null, ...(merchant ? { merchantId: merchant.id } : {}) },
      select: {
        id: true,
        availability: true,
        basePrice: true,
        revision: true,
        variants: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            price: true,
            availability: true,
            stockQuantity: true,
            attributeSelections: {
              orderBy: { attribute: { position: 'asc' } },
              select: {
                attributeId: true,
                valueId: true,
                attribute: { select: { name: true, position: true } },
                value: { select: { value: true } },
              },
            },
          },
        },
        modifierGroups: {
          orderBy: { position: 'asc' },
          include: {
            modifierGroup: { select: { id: true, name: true, description: true } },
            options: {
              orderBy: { option: { position: 'asc' } },
              include: { option: { select: { id: true, name: true, position: true } } },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product was not found.');
    if (product.availability !== 'available') {
      throw new ConflictException('Product is unavailable.');
    }
    const selectedVariant = variantId
      ? product.variants.find((variant) => variant.id === variantId)
      : undefined;
    if (product.variants.length > 0 && !variantId) {
      throw new BadRequestException('Choose a product variant.');
    }
    if (variantId && !selectedVariant) {
      throw new BadRequestException('A variant does not belong to this product.');
    }
    if (
      selectedVariant?.availability !== undefined &&
      selectedVariant.availability !== 'available'
    ) {
      throw new ConflictException('Product variant is unavailable.');
    }
    if (selectedVariant?.stockQuantity === 0) {
      throw new ConflictException('Product variant is out of stock.');
    }

    const requested = new Map<string, string[]>();
    for (const selection of selections) {
      if (requested.has(selection.groupId)) {
        throw new BadRequestException('Each modifier group can be selected only once.');
      }
      requested.set(selection.groupId, selection.optionIds);
    }

    const productGroupIds = new Set(product.modifierGroups.map((group) => group.id));
    if ([...requested.keys()].some((groupId) => !productGroupIds.has(groupId))) {
      throw new BadRequestException('A modifier group does not belong to this product.');
    }

    let modifierTotalCents = 0n;
    const resolvedSelections = product.modifierGroups.map((group) => {
      assertPersistedModifierGroup(group);
      const submittedOptionIds = requested.get(group.id);
      const selectedIds =
        submittedOptionIds ??
        group.options.filter((option) => option.defaultSelected).map((option) => option.optionId);
      if (new Set(selectedIds).size !== selectedIds.length) {
        throw new BadRequestException('Modifier options must be unique within a group.');
      }
      if (selectedIds.length < group.minSelections || selectedIds.length > group.maxSelections) {
        throw new BadRequestException(
          `Select between ${group.minSelections} and ${group.maxSelections} options for ${group.modifierGroup.name}.`,
        );
      }

      const selectedIdSet = new Set(selectedIds);
      const selectedOptions = group.options.filter((option) => selectedIdSet.has(option.optionId));
      if (selectedOptions.length !== selectedIds.length) {
        throw new BadRequestException('A modifier option does not belong to its selected group.');
      }

      const priceAdjustmentCents = selectedOptions.reduce(
        (sum, option) => sum + toCents(option.priceAdjustment.toString()),
        0n,
      );
      modifierTotalCents += priceAdjustmentCents;
      return {
        groupId: group.id,
        modifierGroupId: group.modifierGroupId,
        optionIds: selectedOptions.map((option) => option.optionId),
        priceAdjustment: formatCents(priceAdjustmentCents),
      };
    });

    const basePriceCents = toCents((selectedVariant?.price ?? product.basePrice).toString());
    const variantAttributes = selectedVariant?.attributeSelections.map((selection) => ({
      attributeId: selection.attributeId,
      attributeName: selection.attribute.name,
      valueId: selection.valueId,
      value: selection.value.value,
      position: selection.attribute.position,
    })) ?? [];
    return {
      productId: product.id,
      productRevision: product.revision,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
      variantAttributes,
      currency: 'EGP',
      basePrice: formatCents(basePriceCents),
      modifierTotal: formatCents(modifierTotalCents),
      totalPrice: formatCents(basePriceCents + modifierTotalCents),
      selections: resolvedSelections,
    };
  }

  async create(merchantId: string, actor: string, input: ProductInput) {
    assertBasePrice(input.basePrice);
    assertVariants(input.variants);
    assertModifierConfigurationModes(input.modifierGroups, input.modifierGroupAssignments);
    await this.assertVariantIdentifiers(merchantId, input.variants);
    await this.assertModifierGroupAssignments(merchantId, input.modifierGroupAssignments);
    const primaryImageAssetId = input.primaryImageAssetId ?? input.imageAssetIds[0];
    if (!primaryImageAssetId) throw new BadRequestException('At least one image is required.');
    await this.assertReferences(merchantId, input.imageAssetIds, input.categoryIds);
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
            await createLegacyModifierGroups(transaction, merchantId, created.id, input.modifierGroups);
          }
          if (input.modifierGroupAssignments?.length) {
            await createModifierAssignments(
              transaction,
              merchantId,
              created.id,
              input.modifierGroupAssignments,
            );
          }
          await createVariantsWithAttributes(transaction, merchantId, created.id, input.variants ?? []);
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
      await this.assertVariantIdentifiers(merchantId, input.variants, id);
    }
    if (input.modifierGroupAssignments !== undefined) {
      await this.assertModifierGroupAssignments(merchantId, input.modifierGroupAssignments);
    }
    const categoryIds = input.categoryIds;
    await this.assertReferences(merchantId, imageAssetIds, categoryIds);
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
    await this.assertModifierGroupAssignments(merchantId, [assignment]);
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
      if (isUniqueConflict(error)) {
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
            throw new ConflictException('Products used in an order cannot be deleted; archive it instead.');
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

  private async assertReferences(
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
      this.prisma.mediaAsset.findMany({ where: { merchantId, id: { in: imageAssetIds } } }),
      categoryIds === undefined
        ? Promise.resolve([])
        : this.prisma.category.findMany({
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

  private async assertVariantIdentifiers(
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

    const identifiers = await this.prisma.productVariant.findMany({
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

  private async assertModifierGroupAssignments(
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
    const groups = await this.prisma.modifierGroup.findMany({
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
      if (assignment.options.filter((option) => option.defaultSelected).length > assignment.maxSelections) {
        throw new BadRequestException('Default selections cannot exceed the group selection limit.');
      }
    }
  }
}

const productInclude = {
  images: {
    orderBy: { position: 'asc' as const },
    include: {
      mediaAsset: { select: { id: true, publicUrl: true, mimeType: true, sizeBytes: true } },
    },
  },
  categoryLinks: {
    include: { category: { select: { id: true, name: true, parentId: true, availability: true } } },
  },
  modifierGroups: {
    orderBy: { position: 'asc' as const },
    include: {
      modifierGroup: { select: { id: true, name: true, description: true } },
      options: {
        orderBy: { option: { position: 'asc' as const } },
        include: { option: { select: { id: true, name: true, position: true } } },
      },
    },
  },
  variants: {
    orderBy: { position: 'asc' as const },
    include: {
      attributeSelections: {
        orderBy: { attribute: { position: 'asc' as const } },
        include: {
          attribute: { select: { id: true, name: true, position: true } },
          value: { select: { id: true, value: true } },
        },
      },
    },
  },
} as const;

function toProductResponse(product: Prisma.ProductGetPayload<{ include: typeof productInclude }>) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    basePrice: formatCents(toCents(product.basePrice.toString())),
    currency: 'EGP',
    sellingUnit: 'piece',
    availability: product.availability,
    archivedAt: product.archivedAt?.toISOString() ?? null,
    revision: product.revision,
    images: product.images.map((image) => ({
      id: image.id,
      mediaAssetId: image.mediaAssetId,
      publicUrl: image.mediaAsset.publicUrl,
      mimeType: image.mediaAsset.mimeType,
      sizeBytes: image.mediaAsset.sizeBytes,
      isPrimary: image.isPrimary,
      position: image.position,
    })),
    categories: product.categoryLinks.map(({ category }) => category),
    modifierGroups: product.modifierGroups.map((group) => ({
      id: group.id,
      modifierGroupId: group.modifierGroupId,
      name: group.modifierGroup.name,
      description: group.modifierGroup.description,
      selectionMode: group.selectionMode,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      position: group.position,
      options: group.options.map((option) => ({
        id: option.option.id,
        name: option.option.name,
        priceAdjustment: formatCents(toCents(option.priceAdjustment.toString())),
        defaultSelected: option.defaultSelected,
        position: option.option.position,
      })),
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      price: formatCents(toCents(variant.price.toString())),
      stockQuantity: variant.stockQuantity,
      availability: variant.availability,
      position: variant.position,
      attributes: variant.attributeSelections.map((selection) => ({
        attributeId: selection.attributeId,
        attributeName: selection.attribute.name,
        valueId: selection.valueId,
        value: selection.value.value,
        position: selection.attribute.position,
      })),
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function assertModifierConfigurationModes(
  legacyGroups: ProductInput['modifierGroups'],
  assignments: ProductInput['modifierGroupAssignments'],
): void {
  if (legacyGroups !== undefined && assignments !== undefined) {
    throw new BadRequestException(
      'Use either the legacy modifierGroups field or modifierGroupAssignments, not both.',
    );
  }
}

function assertAssignmentFields(assignment: CatalogProductModifierGroupAssignmentFields): void {
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
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(option.priceAdjustment)) {
      throw new BadRequestException('Modifier price adjustments must be non-negative EGP amounts.');
    }
  }
}

async function createLegacyModifierGroups(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  groups: NonNullable<ProductInput['modifierGroups']>,
): Promise<void> {
  for (const group of groups) {
    const modifierGroupId = randomUUID();
    const options = group.options.map((option) => ({ ...option, id: randomUUID() }));
    await transaction.modifierGroup.create({
      data: {
        id: modifierGroupId,
        merchantId,
        name: group.name.trim(),
        description: group.description?.trim() || null,
        options: {
          create: options.map((option) => ({
            id: option.id,
            name: option.name.trim(),
            position: option.position,
          })),
        },
      },
    });
    const assignment = await transaction.productModifierGroupAssignment.create({
      data: {
        productId,
        modifierGroupId,
        merchantId,
        selectionMode: group.selectionMode,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        position: group.position,
      },
      select: { id: true },
    });
    await transaction.productModifierGroupAssignmentOption.createMany({
      data: options.map((option) => ({
        assignmentId: assignment.id,
        modifierGroupId,
        optionId: option.id,
        merchantId,
        priceAdjustment: option.priceAdjustment,
        defaultSelected: option.defaultSelected,
      })),
    });
  }
}

async function createModifierAssignments(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  assignments: NonNullable<ProductInput['modifierGroupAssignments']>,
): Promise<void> {
  await assertAssignmentReferences(transaction, merchantId, assignments);
  for (const item of assignments) {
    const assignment = await transaction.productModifierGroupAssignment.create({
      data: {
        productId,
        modifierGroupId: item.modifierGroupId,
        merchantId,
        selectionMode: item.selectionMode,
        minSelections: item.minSelections,
        maxSelections: item.maxSelections,
        position: item.position,
      },
      select: { id: true },
    });
    await transaction.productModifierGroupAssignmentOption.createMany({
      data: item.options.map((option) => ({
        assignmentId: assignment.id,
        modifierGroupId: item.modifierGroupId,
        optionId: option.optionId,
        merchantId,
        priceAdjustment: option.priceAdjustment,
        defaultSelected: option.defaultSelected,
      })),
    });
  }
}

async function replaceModifierAssignments(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  assignments: NonNullable<ProductInput['modifierGroupAssignments']>,
): Promise<void> {
  await assertAssignmentReferences(transaction, merchantId, assignments);
  const current = await transaction.productModifierGroupAssignment.findMany({
    where: { productId, merchantId },
    select: { id: true, modifierGroupId: true },
  });
  const byGroupId = new Map(current.map((assignment) => [assignment.modifierGroupId, assignment]));
  const requestedGroupIds = assignments.map((assignment) => assignment.modifierGroupId);
  await transaction.productModifierGroupAssignment.deleteMany({
    where: {
      productId,
      merchantId,
      ...(requestedGroupIds.length ? { modifierGroupId: { notIn: requestedGroupIds } } : {}),
    },
  });

  for (const item of assignments) {
    const existing = byGroupId.get(item.modifierGroupId);
    const assignment = existing
      ? await transaction.productModifierGroupAssignment.update({
          where: { id: existing.id },
          data: {
            selectionMode: item.selectionMode,
            minSelections: item.minSelections,
            maxSelections: item.maxSelections,
            position: item.position,
          },
          select: { id: true },
        })
      : await transaction.productModifierGroupAssignment.create({
          data: {
            productId,
            modifierGroupId: item.modifierGroupId,
            merchantId,
            selectionMode: item.selectionMode,
            minSelections: item.minSelections,
            maxSelections: item.maxSelections,
            position: item.position,
          },
          select: { id: true },
        });
    if (existing) {
      await transaction.productModifierGroupAssignmentOption.deleteMany({
        where: { assignmentId: assignment.id },
      });
    }
    await transaction.productModifierGroupAssignmentOption.createMany({
      data: item.options.map((option) => ({
        assignmentId: assignment.id,
        modifierGroupId: item.modifierGroupId,
        optionId: option.optionId,
        merchantId,
        priceAdjustment: option.priceAdjustment,
        defaultSelected: option.defaultSelected,
      })),
    });
  }
}

async function assertAssignmentReferences(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  assignments: NonNullable<ProductInput['modifierGroupAssignments']>,
): Promise<void> {
  if (assignments.length === 0) return;
  const ids = [...new Set(assignments.map((assignment) => assignment.modifierGroupId))];
  const groups = await transaction.modifierGroup.findMany({
    where: { merchantId, id: { in: ids } },
    select: { id: true, options: { select: { id: true } } },
  });
  if (groups.length !== ids.length) {
    throw new BadRequestException('Every modifier group must belong to this merchant.');
  }
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const assignment of assignments) {
    const group = byId.get(assignment.modifierGroupId);
    const allowedOptionIds = new Set(group?.options.map((option) => option.id) ?? []);
    const requestedOptionIds = assignment.options.map((option) => option.optionId);
    if (
      !group ||
      new Set(requestedOptionIds).size !== requestedOptionIds.length ||
      requestedOptionIds.length !== allowedOptionIds.size ||
      requestedOptionIds.some((optionId) => !allowedOptionIds.has(optionId))
    ) {
      throw new BadRequestException(
        'Assignment configuration must include every option from the modifier group exactly once.',
      );
    }
    if (assignment.options.filter((option) => option.defaultSelected).length > assignment.maxSelections) {
      throw new BadRequestException('Default selections cannot exceed the group selection limit.');
    }
  }
}

type ExistingVariantConfiguration = Prisma.ProductVariantGetPayload<{
  include: { attributeSelections: true };
}>;

type ExistingVariantAttribute = Prisma.ProductVariantAttributeGetPayload<{
  include: { values: true };
}>;

async function createVariantsWithAttributes(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  variants: NonNullable<ProductInput['variants']>,
): Promise<void> {
  await persistVariantsWithAttributes(transaction, merchantId, productId, variants, [], []);
}

async function replaceVariantsWithAttributes(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  variants: NonNullable<ProductInput['variants']>,
): Promise<void> {
  const [existingVariants, existingAttributes] = await Promise.all([
    transaction.productVariant.findMany({
      where: { productId, merchantId },
      include: { attributeSelections: true },
    }),
    transaction.productVariantAttribute.findMany({
      where: { productId, merchantId },
      include: { values: true },
    }),
  ]);
  const requestedIds = variants.map((variant) => variant.id).filter((id): id is string => !!id);
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new BadRequestException('Variant IDs must be unique within a product.');
  }
  const existingIds = new Set(existingVariants.map((variant) => variant.id));
  if (requestedIds.some((variantId) => !existingIds.has(variantId))) {
    throw new BadRequestException('Every existing variant ID must belong to this product.');
  }
  await persistVariantsWithAttributes(
    transaction,
    merchantId,
    productId,
    variants,
    existingVariants,
    existingAttributes,
  );
}

async function persistVariantsWithAttributes(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  variants: NonNullable<ProductInput['variants']>,
  existingVariants: ExistingVariantConfiguration[],
  existingAttributes: ExistingVariantAttribute[],
): Promise<void> {
  const existingVariantById = new Map(existingVariants.map((variant) => [variant.id, variant]));
  const existingAttributeById = new Map(existingAttributes.map((attribute) => [attribute.id, attribute]));
  const existingAttributeByName = new Map(
    existingAttributes.map((attribute) => [normalizeAttributeName(attribute.name), attribute]),
  );
  const variantIds = new Map<CatalogProductVariantFields, string>();
  for (const variant of variants) variantIds.set(variant, variant.id ?? randomUUID());

  const attributePlan = new Map<
    string,
    {
      id: string;
      name: string;
      position: number;
      existing?: ExistingVariantAttribute;
      values: Map<string, { id: string; value: string; position: number; existing?: ExistingVariantAttribute['values'][number] }>;
    }
  >();
  const attributeIdByName = new Map<string, string>();
  const selections: Array<{
    variantId: string;
    attributeId: string;
    valueId: string;
    productId: string;
    merchantId: string;
  }> = [];

  for (const variant of variants) {
    const seenDimensions = new Set<string>();
    for (const [attributePosition, selection] of (variant.attributes ?? []).entries()) {
      const name = selection.name.trim();
      const value = selection.value.trim();
      if (!name || name.length > 120 || !value || value.length > 120) {
        throw new BadRequestException('Variant attribute names and values must contain 1 to 120 characters.');
      }
      const nameKey = normalizeAttributeName(name);
      if (seenDimensions.has(nameKey)) {
        throw new BadRequestException('A variant can select only one value for each attribute.');
      }
      seenDimensions.add(nameKey);
      const currentAttribute = selection.attributeId
        ? existingAttributeById.get(selection.attributeId)
        : existingAttributeByName.get(nameKey);
      if (selection.attributeId && !currentAttribute) {
        throw new BadRequestException('Variant attribute does not belong to this product.');
      }
      const attributeId =
        selection.attributeId ?? currentAttribute?.id ?? attributeIdByName.get(nameKey) ?? randomUUID();
      const mappedAttributeId = attributeIdByName.get(nameKey);
      if (mappedAttributeId && mappedAttributeId !== attributeId) {
        throw new BadRequestException('A variant attribute name must use one stable identity per product.');
      }
      attributeIdByName.set(nameKey, attributeId);
      const attribute = attributePlan.get(attributeId) ?? {
        id: attributeId,
        name,
        position: currentAttribute?.position ?? attributePosition,
        ...(currentAttribute ? { existing: currentAttribute } : {}),
        values: new Map(),
      };
      if (normalizeAttributeName(attribute.name) !== nameKey) {
        throw new BadRequestException('A variant attribute ID cannot represent multiple dimensions.');
      }

      const valueKey = normalizeAttributeName(value);
      const currentValue = selection.valueId
        ? currentAttribute?.values.find((item) => item.id === selection.valueId)
        : currentAttribute?.values.find((item) => normalizeAttributeName(item.value) === valueKey) ??
          [...attribute.values.values()].find((item) => normalizeAttributeName(item.value) === valueKey);
      if (selection.valueId && !currentValue) {
        throw new BadRequestException('Variant attribute value does not belong to this product dimension.');
      }
      const valueId = selection.valueId ?? currentValue?.id ?? randomUUID();
      const plannedValue = attribute.values.get(valueId) ?? {
        id: valueId,
        value,
        position: currentValue?.position ?? attribute.values.size,
        ...(currentValue ? { existing: currentValue } : {}),
      };
      if (normalizeAttributeName(plannedValue.value) !== valueKey) {
        throw new BadRequestException('A variant attribute value ID cannot represent multiple values.');
      }
      attribute.values.set(valueId, plannedValue);
      attributePlan.set(attributeId, attribute);
      selections.push({
        variantId: variantIds.get(variant)!,
        attributeId,
        valueId,
        productId,
        merchantId,
      });
    }
  }

  const usedAttributeIds = new Set([...attributePlan.values()].map((attribute) => attribute.id));
  const retainedVariantIds = new Set([...variantIds.values()]);
  if (existingVariants.length) {
    await transaction.productVariantAttributeSelection.deleteMany({ where: { productId, merchantId } });
    if (retainedVariantIds.size) {
      await transaction.productVariant.deleteMany({
        where: { productId, merchantId, id: { notIn: [...retainedVariantIds] } },
      });
    } else {
      await transaction.productVariant.deleteMany({ where: { productId, merchantId } });
    }
  }
  const unusedAttributeIds = existingAttributes
    .filter((attribute) => !usedAttributeIds.has(attribute.id))
    .map((attribute) => attribute.id);
  if (unusedAttributeIds.length) {
    await transaction.productVariantAttribute.deleteMany({
      where: { productId, merchantId, id: { in: unusedAttributeIds } },
    });
  }

  for (const attribute of attributePlan.values()) {
    if (attribute.existing) {
      await transaction.productVariantAttribute.update({
        where: { id: attribute.id },
        data: { name: attribute.name, position: attribute.position },
      });
    } else {
      await transaction.productVariantAttribute.create({
        data: {
          id: attribute.id,
          productId,
          merchantId,
          name: attribute.name,
          position: attribute.position,
        },
      });
    }
    const plannedValueIds = new Set([...attribute.values.values()].map((value) => value.id));
    const previousValues = attribute.existing?.values ?? [];
    const removedValueIds = previousValues.filter((value) => !plannedValueIds.has(value.id)).map((value) => value.id);
    if (removedValueIds.length) {
      await transaction.productVariantAttributeValue.deleteMany({
        where: { attributeId: attribute.id, productId, merchantId, id: { in: removedValueIds } },
      });
    }
    for (const value of attribute.values.values()) {
      if (value.existing) {
        await transaction.productVariantAttributeValue.update({
          where: { id: value.id },
          data: { value: value.value, position: value.position },
        });
      } else {
        await transaction.productVariantAttributeValue.create({
          data: {
            id: value.id,
            attributeId: attribute.id,
            productId,
            merchantId,
            value: value.value,
            position: value.position,
          },
        });
      }
    }
  }

  for (const variant of variants) {
    const variantId = variantIds.get(variant)!;
    const data = { ...toVariantCreateData(variant), position: variant.position };
    if (existingVariantById.has(variantId)) {
      await transaction.productVariant.update({ where: { id: variantId }, data });
    } else {
      await transaction.productVariant.create({
        data: { id: variantId, productId, merchantId, ...data },
      });
    }
  }
  if (selections.length) {
    await transaction.productVariantAttributeSelection.createMany({ data: selections });
  }
}

function normalizeAttributeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function assertVariants(variants: CatalogProductVariantFields[] | undefined): void {
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
        throw new BadRequestException('Variant attributes must have unique names and non-empty values.');
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

function toVariantCreateData(variant: CatalogProductVariantFields) {
  return {
    name: variant.name.trim(),
    sku: normalizeVariantCode(variant.sku) || null,
    barcode: normalizeVariantCode(variant.barcode) || null,
    price: variant.price,
    stockQuantity: variant.stockQuantity ?? null,
    availability: variant.availability,
    position: variant.position,
  };
}

function normalizeVariantCode(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLocaleUpperCase();
  return normalized || undefined;
}

function assertBasePrice(value: string): void {
  if (!isValidProductPrice(value)) {
    throw new BadRequestException(
      `Base price must be between 0.01 and ${MAX_PRODUCT_PRICE} EGP with at most two decimals.`,
    );
  }
}

function assertPersistedModifierGroup(group: {
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

function toCents(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new ConflictException('Product has an invalid price configuration.');
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function isSerializationConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2034'
  );
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function formatCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}
