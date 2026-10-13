import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { MAX_PRODUCT_IMAGES } from './catalog.constants.js';

export type ProductInput = {
  name: string;
  description?: string | undefined;
  basePrice: string;
  availability: 'available' | 'unavailable';
  imageAssetIds: string[];
  primaryImageAssetId?: string | undefined;
  categoryIds: string[];
};
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

  async create(merchantId: string, actor: string, input: ProductInput) {
    assertBasePrice(input.basePrice);
    const primaryImageAssetId = input.primaryImageAssetId ?? input.imageAssetIds[0];
    if (!primaryImageAssetId) throw new BadRequestException('At least one image is required.');
    await this.assertReferences(merchantId, input.imageAssetIds, input.categoryIds);
    if (!input.imageAssetIds.includes(primaryImageAssetId)) {
      throw new BadRequestException('Primary image must be one of the product images.');
    }
    const product = await this.prisma.product.create({
      data: {
        merchantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        basePrice: input.basePrice,
        availability: input.availability,
        createdBy: actor,
        updatedBy: actor,
        images: {
          create: input.imageAssetIds.map((mediaAssetId, position) => ({
            merchantId,
            mediaAssetId,
            position,
            isPrimary: mediaAssetId === primaryImageAssetId,
          })),
        },
        categoryLinks: {
          create: input.categoryIds.map((categoryId) => ({ categoryId, merchantId })),
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
    const categoryIds = input.categoryIds;
    await this.assertReferences(merchantId, imageAssetIds, categoryIds);
    if (!imageAssetIds.includes(primaryImageAssetId)) {
      throw new BadRequestException('Primary image must be one of the product images.');
    }

    const product = await this.prisma.$transaction(async (transaction) => {
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
      return transaction.product.findUniqueOrThrow({ where: { id }, include: productInclude });
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
    await this.prisma.$transaction(async (transaction) => {
      await transaction.productImage.deleteMany({ where: { productId: id } });
      await transaction.productCategory.deleteMany({ where: { productId: id } });
      await transaction.product.delete({ where: { id } });
    });
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
        : this.prisma.category.findMany({ where: { merchantId, id: { in: categoryIds } } }),
    ]);
    if (images.length !== imageAssetIds.length) {
      throw new BadRequestException('Every image must belong to this merchant.');
    }
    if (categoryIds !== undefined && categories.length !== categoryIds.length) {
      throw new BadRequestException('Every category must belong to this merchant.');
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
} as const;

function toProductResponse(product: {
  id: string;
  name: string;
  description: string | null;
  basePrice: { toString(): string };
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
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    basePrice: product.basePrice.toString(),
    currency: 'EGP',
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
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function assertBasePrice(value: string): void {
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
    throw new BadRequestException(
      'Base price must be a positive EGP amount with at most two decimals.',
    );
  }
}
