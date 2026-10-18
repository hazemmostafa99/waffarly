import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CursorPage, PosSellableCatalog, PublicStorefrontCatalog } from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { sellableInclude, toSellableResponse } from './products/product.mapper.js';

type PublicStorefrontCategory = PublicStorefrontCatalog['categories'][number];
type PublicStorefrontProduct = PublicStorefrontCatalog['products'][number];

@Injectable()
export class CatalogQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPublicStorefrontCatalog(slug: string): Promise<PublicStorefrontCatalog> {
    const merchant = await this.findPublicMerchant(slug);
    const [categoryPage, productPage] = await Promise.all([
      this.listPublicCategories(merchant.id),
      this.listPublicProducts(merchant.id),
    ]);

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
      categories: categoryPage.items,
      nextCategoryCursor: categoryPage.nextCursor,
      products: productPage.items,
      nextProductCursor: productPage.nextCursor,
    };
  }

  async getPosSellableCatalog(
    merchantId: string,
    productCursor?: string,
    categoryCursor?: string,
  ): Promise<PosSellableCatalog> {
    const [categories, products] = await Promise.all([
      this.listPublicCategories(merchantId, categoryCursor),
      this.listPublicProducts(merchantId, productCursor),
    ]);
    return { categories, products };
  }

  async getPublicStorefrontCategories(
    slug: string,
    cursor?: string,
  ): Promise<CursorPage<PublicStorefrontCategory>> {
    const merchantId = await this.findPublicMerchantId(slug);
    return this.listPublicCategories(merchantId, cursor);
  }

  async getPublicStorefrontProducts(
    slug: string,
    cursor?: string,
  ): Promise<CursorPage<PublicStorefrontProduct>> {
    const merchantId = await this.findPublicMerchantId(slug);
    return this.listPublicProducts(merchantId, cursor);
  }

  private async findPublicMerchant(slug: string) {
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
    return merchant;
  }

  private async findPublicMerchantId(slug: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Storefront was not found.');
    return merchant.id;
  }

  private async listPublicCategories(
    merchantId: string,
    cursor?: string,
  ): Promise<CursorPage<PublicStorefrontCategory>> {
    const visibleCategoryWhere = {
      merchantId,
      availability: 'available' as const,
      archivedAt: null,
      OR: [
        { parentId: null },
        { parent: { is: { availability: 'available' as const, archivedAt: null } } },
      ],
    };
    if (cursor) {
      const anchor = await this.prisma.category.findFirst({
        where: { ...visibleCategoryWhere, id: cursor },
        select: { id: true },
      });
      if (!anchor) throw new BadRequestException('Category pagination cursor is invalid.');
    }

    const categories = await this.prisma.category.findMany({
      where: visibleCategoryWhere,
      select: { id: true, name: true, parentId: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: 101,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = categories.length > 100;
    const items = categories.slice(0, 100);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  private async listPublicProducts(
    merchantId: string,
    cursor?: string,
  ): Promise<CursorPage<PublicStorefrontProduct>> {
    const visibleCategoryWhere = {
      availability: 'available' as const,
      archivedAt: null,
      OR: [
        { parentId: null },
        { parent: { is: { availability: 'available' as const, archivedAt: null } } },
      ],
    };
    const visibleProductWhere = {
      merchantId,
      availability: 'available' as const,
      archivedAt: null,
    };
    if (cursor) {
      const anchor = await this.prisma.product.findFirst({
        where: { ...visibleProductWhere, id: cursor },
        select: { id: true },
      });
      if (!anchor) throw new BadRequestException('Product pagination cursor is invalid.');
    }

    const products = await this.prisma.product.findMany({
      where: {
        ...visibleProductWhere,
        OR: [
          { categoryLinks: { none: {} } },
          {
            categoryLinks: {
              some: {
                merchantId,
                category: { is: visibleCategoryWhere },
              },
            },
          },
        ],
      },
      include: {
        ...sellableInclude,
        categoryLinks: {
          where: { merchantId },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                parentId: true,
                availability: true,
                archivedAt: true,
                parent: { select: { availability: true, archivedAt: true } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 41,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = products.length > 40;
    const page = products.slice(0, 40);
    const items = page.map((product) => {
      const publicProduct = toSellableResponse(product);
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
        categories: product.categoryLinks
          .filter(
            ({ category }) =>
              category.availability === 'available' &&
              category.archivedAt === null &&
              (!category.parent ||
                (category.parent.availability === 'available' &&
                  category.parent.archivedAt === null)),
          )
          .map(({ category }) => ({ id: category.id, name: category.name })),
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
              availability === 'available' && stockQuantity !== 0
                ? ('available' as const)
                : ('unavailable' as const),
            position,
            attributes,
          }),
        ),
      };
    });

    return { items, nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
  }
}
