import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CatalogCategoryFields } from '@waffarly/contracts';
import type { CursorPage } from '@waffarly/contracts';
import { assertScopedCursor, type CursorPageQuery } from '../../../common/http/pagination.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

export type CategoryInput = CatalogCategoryFields;
type CategoryPatch = { [Key in keyof CategoryInput]?: CategoryInput[Key] | undefined };

@Injectable()
export class CategoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    merchantId: string,
    page: CursorPageQuery = { limit: 50 },
  ): Promise<CursorPage<ReturnType<typeof toCategoryResponse> & { effectiveVisible: boolean }>> {
    if (page.cursor) {
      const anchor = await this.prisma.category.findFirst({
        where: { id: page.cursor, merchantId },
        select: { id: true },
      });
      assertScopedCursor(page.cursor, anchor !== null);
    }
    const categories = await this.prisma.category.findMany({
      where: { merchantId },
      include: {
        imageAsset: { select: { id: true, publicUrl: true, mimeType: true, sizeBytes: true } },
        parent: { select: { id: true, name: true, availability: true, archivedAt: true } },
        _count: { select: { children: true, productLinks: true } },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });
    const hasMore = categories.length > page.limit;
    const items = categories.slice(0, page.limit).map((category) => ({
      ...toCategoryResponse(category),
      effectiveVisible: isEffectivelyVisible(category),
    }));
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async create(merchantId: string, actor: string, input: CategoryInput) {
    await this.assertImage(merchantId, input.imageAssetId);
    await this.assertParent(merchantId, input.parentId ?? null);
    const category = await this.prisma.category.create({
      data: {
        merchantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        imageAssetId: input.imageAssetId,
        parentId: input.parentId ?? null,
        availability: input.availability,
        createdBy: actor,
        updatedBy: actor,
      },
      include: categoryInclude,
    });
    return { ...toCategoryResponse(category), effectiveVisible: isEffectivelyVisible(category) };
  }

  async update(
    merchantId: string,
    actor: string,
    id: string,
    revision: number,
    input: CategoryPatch,
  ) {
    if (input.imageAssetId) await this.assertImage(merchantId, input.imageAssetId);
    if (input.parentId !== undefined) await this.assertParent(merchantId, input.parentId, id);
    const changed = await this.prisma.category.updateMany({
      where: { id, merchantId, revision },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.description === undefined
          ? {}
          : { description: input.description.trim() || null }),
        ...(input.imageAssetId === undefined ? {} : { imageAssetId: input.imageAssetId }),
        ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
        ...(input.availability === undefined ? {} : { availability: input.availability }),
        updatedBy: actor,
        revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictException('Category is missing or stale.');
    const category = await this.prisma.category.findUniqueOrThrow({
      where: { id },
      include: categoryInclude,
    });
    return { ...toCategoryResponse(category), effectiveVisible: isEffectivelyVisible(category) };
  }

  async archive(merchantId: string, actor: string, id: string, revision: number) {
    const changed = await this.prisma.category.updateMany({
      where: { id, merchantId, revision, archivedAt: null },
      data: { archivedAt: new Date(), updatedBy: actor, revision: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ConflictException('Category is missing or stale.');
    return this.get(merchantId, id);
  }

  async restore(merchantId: string, actor: string, id: string, revision: number) {
    const changed = await this.prisma.category.updateMany({
      where: { id, merchantId, revision, archivedAt: { not: null } },
      data: {
        archivedAt: null,
        availability: 'unavailable',
        updatedBy: actor,
        revision: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ConflictException('Category is missing or stale.');
    return this.get(merchantId, id);
  }

  async remove(merchantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, merchantId },
      include: { _count: { select: { children: true, productLinks: true } } },
    });
    if (!category) throw new NotFoundException('Category was not found.');
    if (category._count.children > 0 || category._count.productLinks > 0) {
      throw new ConflictException('Only an unlinked category without children can be deleted.');
    }
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }

  private async get(merchantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, merchantId },
      include: categoryInclude,
    });
    if (!category) throw new NotFoundException('Category was not found.');
    return { ...toCategoryResponse(category), effectiveVisible: isEffectivelyVisible(category) };
  }

  private async assertImage(merchantId: string, imageAssetId: string): Promise<void> {
    const image = await this.prisma.mediaAsset.findFirst({
      where: { id: imageAssetId, merchantId },
    });
    if (!image) throw new BadRequestException('Image does not belong to this merchant.');
  }

  private async assertParent(
    merchantId: string,
    parentId: string | null,
    categoryId?: string,
  ): Promise<void> {
    if (!parentId) return;
    if (parentId === categoryId) {
      throw new BadRequestException('A category cannot be its own parent.');
    }
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: categoryId, merchantId },
        include: { _count: { select: { children: true } } },
      });
      if (category && category._count.children > 0) {
        throw new BadRequestException('A category with children cannot become a child category.');
      }
    }
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, merchantId, parentId: null, archivedAt: null },
    });
    if (!parent) throw new BadRequestException('Parent must be an active main category.');
  }
}

const categoryInclude = {
  imageAsset: { select: { id: true, publicUrl: true, mimeType: true, sizeBytes: true } },
  parent: { select: { id: true, name: true, availability: true, archivedAt: true } },
  _count: { select: { children: true, productLinks: true } },
} as const;

function toCategoryResponse(category: {
  id: string;
  name: string;
  description: string | null;
  imageAsset: { id: string; publicUrl: string; mimeType: string; sizeBytes: number };
  parentId: string | null;
  parent?: { id: string; name: string; availability: string; archivedAt: Date | null } | null;
  availability: string;
  archivedAt: Date | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: { children: number; productLinks: number };
}) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    image: category.imageAsset,
    parentId: category.parentId,
    parent: category.parent ?? null,
    availability: category.availability,
    archivedAt: category.archivedAt?.toISOString() ?? null,
    revision: category.revision,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    childCount: category._count?.children ?? 0,
    productCount: category._count?.productLinks ?? 0,
  };
}

function isEffectivelyVisible(category: {
  availability: string;
  archivedAt: Date | null;
  parent?: { availability: string; archivedAt: Date | null } | null;
}): boolean {
  return (
    category.availability === 'available' &&
    category.archivedAt === null &&
    (category.parent === undefined ||
      category.parent === null ||
      (category.parent.availability === 'available' && category.parent.archivedAt === null))
  );
}
