import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CatalogProductFields,
  CatalogProductQuoteResponse,
  CatalogProductQuoteSelection,
  CatalogProductVariantFields,
  PublicStorefrontCatalog,
} from '@waffarly/contracts';
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
              ({ id, name, price, availability, position, stockQuantity }) => ({
                id,
                name,
                price,
                availability:
                  availability === 'available' && stockQuantity !== 0 ? 'available' : 'unavailable',
                position,
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
          },
        },
        modifierGroups: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } },
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
        group.options.filter((option) => option.defaultSelected).map((option) => option.id);
      if (new Set(selectedIds).size !== selectedIds.length) {
        throw new BadRequestException('Modifier options must be unique within a group.');
      }
      if (selectedIds.length < group.minSelections || selectedIds.length > group.maxSelections) {
        throw new BadRequestException(
          `Select between ${group.minSelections} and ${group.maxSelections} options for ${group.name}.`,
        );
      }

      const selectedIdSet = new Set(selectedIds);
      const selectedOptions = group.options.filter((option) => selectedIdSet.has(option.id));
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
        optionIds: selectedOptions.map((option) => option.id),
        priceAdjustment: formatCents(priceAdjustmentCents),
      };
    });

    const basePriceCents = toCents((selectedVariant?.price ?? product.basePrice).toString());
    return {
      productId: product.id,
      productRevision: product.revision,
      variantId: selectedVariant?.id ?? null,
      variantName: selectedVariant?.name ?? null,
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
    await this.assertVariantIdentifiers(merchantId, input.variants);
    const primaryImageAssetId = input.primaryImageAssetId ?? input.imageAssetIds[0];
    if (!primaryImageAssetId) throw new BadRequestException('At least one image is required.');
    await this.assertReferences(merchantId, input.imageAssetIds, input.categoryIds);
    if (!input.imageAssetIds.includes(primaryImageAssetId)) {
      throw new BadRequestException('Primary image must be one of the product images.');
    }
    const product = await this.prisma.product.create({
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
        modifierGroups: {
          create: (input.modifierGroups ?? []).map((group) => ({
            name: group.name.trim(),
            description: group.description?.trim() || null,
            selectionMode: group.selectionMode,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            position: group.position,
            options: {
              create: group.options.map((option) => ({
                name: option.name.trim(),
                priceAdjustment: option.priceAdjustment,
                defaultSelected: option.defaultSelected,
                position: option.position,
              })),
            },
          })),
        },
        variants: {
          create: (input.variants ?? []).map(toVariantCreateData),
        },
      },
      include: productInclude,
    });
    return toProductResponse(product);
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
    if (input.variants !== undefined) {
      await this.assertVariantIdentifiers(merchantId, input.variants, id);
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
      if (input.modifierGroups !== undefined) {
        await transaction.productModifierGroup.deleteMany({ where: { productId: id, merchantId } });
        await transaction.product.update({
          where: { id },
          data: {
            modifierGroups: {
              create: input.modifierGroups.map((group) => ({
                name: group.name.trim(),
                description: group.description?.trim() || null,
                selectionMode: group.selectionMode,
                minSelections: group.minSelections,
                maxSelections: group.maxSelections,
                position: group.position,
                options: {
                  create: group.options.map((option) => ({
                    name: option.name.trim(),
                    priceAdjustment: option.priceAdjustment,
                    defaultSelected: option.defaultSelected,
                    position: option.position,
                  })),
                },
              })),
            },
          },
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
        await transaction.productVariant.deleteMany({ where: { productId: id, merchantId } });
        if (input.variants.length > 0) {
          await transaction.productVariant.createMany({
            data: input.variants.map((variant) => ({
              productId: id,
              merchantId,
              ...toVariantCreateData(variant),
            })),
          });
        }
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
    include: { options: { orderBy: { position: 'asc' as const } } },
  },
  variants: { orderBy: { position: 'asc' as const } },
} as const;

function toProductResponse(product: {
  id: string;
  name: string;
  description: string | null;
  basePrice: { toString(): string };
  sellingUnit: string;
  availability: string;
  archivedAt: Date | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  images: Array<{
    id: string;
    mediaAssetId: string;
    isPrimary: boolean;
    position: number;
    mediaAsset: { id: string; publicUrl: string; mimeType: string; sizeBytes: number };
  }>;
  categoryLinks: Array<{
    category: { id: string; name: string; parentId: string | null; availability: string };
  }>;
  modifierGroups: Array<{
    id: string;
    name: string;
    description: string | null;
    selectionMode: string;
    minSelections: number;
    maxSelections: number;
    position: number;
    options: Array<{
      id: string;
      name: string;
      priceAdjustment: { toString(): string };
      defaultSelected: boolean;
      position: number;
    }>;
  }>;
  variants: Array<{
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    price: { toString(): string };
    stockQuantity: number | null;
    availability: string;
    position: number;
  }>;
}) {
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
      name: group.name,
      description: group.description,
      selectionMode: group.selectionMode,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      position: group.position,
      options: group.options.map((option) => ({
        id: option.id,
        name: option.name,
        priceAdjustment: formatCents(toCents(option.priceAdjustment.toString())),
        defaultSelected: option.defaultSelected,
        position: option.position,
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
    })),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function assertVariants(variants: CatalogProductVariantFields[] | undefined): void {
  if (variants === undefined) return;
  if (variants.length > 100)
    throw new BadRequestException('A product can have at most 100 variants.');
  const positions = new Set<number>();
  const skus = new Set<string>();
  const barcodes = new Set<string>();
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

function formatCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}
