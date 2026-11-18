import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CursorPage, PosSellableCatalog, PublicStorefrontCatalog } from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { sellableInclude, toSellableResponse } from './products/product.mapper.js';

type PublicStorefrontCategory = PublicStorefrontCatalog['categories'][number];
type PublicStorefrontProduct = PublicStorefrontCatalog['products'][number];

function imageSource(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('src' in value)) return null;
  return typeof value.src === 'string' ? value.src : null;
}

function storefrontLogoScale(
  value: string | undefined,
): PublicStorefrontCatalog['logoScale'] {
  return value === 'small' || value === 'large' ? value : 'medium';
}

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
      restaurantDescription: merchant.restaurantProfile?.description ?? null,
      primaryColor: merchant.storefront?.primaryColor ?? '#0f705a',
      accentColor: merchant.storefront?.accentColor ?? '#f5b544',
      backgroundColor: merchant.storefront?.backgroundColor ?? '#faf8f4',
      surfaceColor: merchant.storefront?.surfaceColor ?? '#ffffff',
      logoScale: storefrontLogoScale(merchant.storefront?.logoScale),
      logoData:
        imageSource(merchant.restaurantProfile?.logoImage) ?? merchant.storefront?.logoData ?? null,
      coverImageUrl: imageSource(merchant.restaurantProfile?.coverImage),
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

  async getMarketplaceMenu(slug: string, cursor?: string, productId?: string) {
    const merchantId = await this.findPublicMerchantId(slug);
    if (
      cursor &&
      !(await this.prisma.product.findFirst({
        where: { id: cursor, merchantId, archivedAt: null },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Invalid product cursor.');
    const records = await this.prisma.product.findMany({
      where: {
        merchantId,
        ...(productId ? { id: productId } : {}),
        archivedAt: null,
        OR: [
          { menuSection: { availability: 'available', archivedAt: null } },
          {
            menuSectionId: null,
            categoryLinks: {
              some: { merchantId, category: { availability: 'available', archivedAt: null } },
            },
          },
        ],
      },
      include: sellableInclude,
      orderBy: [{ menuSection: { displayOrder: 'asc' } }, { displayOrder: 'asc' }, { id: 'asc' }],
      take: 41,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return {
      items: records.slice(0, 40).map((record) => {
        const product = toSellableResponse(record);
        return {
          id: product.id,
          referenceKey: record.referenceKey,
          name: product.name,
          description: product.description,
          basePrice: product.basePrice,
          promotion: product.promotion,
          promotionalPrice: product.promotionalPrice,
          currency: 'EGP' as const,
          availability: product.availability,
          displayOrder: record.displayOrder,
          menuSectionId: record.menuSectionId,
          images: product.images.map(({ publicUrl, isPrimary, position }) => ({
            publicUrl,
            isPrimary,
            position,
          })),
          categories: product.categories.filter(
            (category) => category.availability === 'available',
          ),
          modifierGroups: product.modifierGroups,
          variants: product.variants.map(
            ({ id, name, price, promotionalPrice, availability, position, attributes, stockQuantity }) => ({
              id,
              name,
              price,
              promotionalPrice,
              availability:
                availability === 'available' && stockQuantity !== 0 ? 'available' : 'unavailable',
              position,
              attributes,
            }),
          ),
        };
      }),
      nextCursor: records.length > 40 ? records[39]!.id : null,
    };
  }

  private async findPublicMerchant(slug: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: {
        id: true,
        name: true,
        activity: true,
        storefrontSlug: true,
        restaurantProfile: {
          select: { description: true, logoImage: true, coverImage: true },
        },
        storefront: {
          select: {
            primaryColor: true,
            accentColor: true,
            backgroundColor: true,
            surfaceColor: true,
            logoScale: true,
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
        promotion: publicProduct.promotion,
        promotionalPrice: publicProduct.promotionalPrice,
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
          ({ id, name, price, promotionalPrice, availability, position, stockQuantity, attributes }) => ({
            id,
            name,
            price,
            promotionalPrice,
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
