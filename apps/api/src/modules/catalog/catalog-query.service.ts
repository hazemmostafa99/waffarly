import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PublicStorefrontCatalog } from '@waffarly/contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { productInclude, toProductResponse } from './products/product.mapper.js';
@Injectable()
export class CatalogQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
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
}
