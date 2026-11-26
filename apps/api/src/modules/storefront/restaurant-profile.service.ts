import { Prisma } from '@waffarly/database';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { restaurantSettingsSchema } from './restaurant.schemas.js';
import { toRestaurantSettings } from './restaurant-settings.mapper.js';
import { restaurantOperatingState, type RestaurantOrderChannel } from './restaurant-hours.js';
import { CatalogQueryService } from '../catalog/index.js';
import { formatCents, toCents } from '../../common/money/money.js';
import { restaurantOnlineBranches } from './restaurant-branch-fulfillment.js';

@Injectable()
export class RestaurantProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogQueryService) private readonly catalog: CatalogQueryService,
  ) {}
  async get(merchantId: string) {
    const record = await this.prisma.restaurantProfile.findUnique({ where: { merchantId } });
    if (!record) throw new NotFoundException('Restaurant profile was not found.');
    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: { name: true },
    });
    return { ...this.map(record), name: merchant.name };
  }
  private map(record: Prisma.RestaurantProfileModel) {
    const settings = toRestaurantSettings(record);
    const fees = settings.deliveryAreas.length
      ? settings.deliveryAreas.map((area) => toCents(area.fee))
      : [toCents(settings.deliveryFee)];
    return {
      ...settings,
      merchantId: record.merchantId,
      updatedAt: record.updatedAt.toISOString(),
      ...restaurantOperatingState(settings),
      deliveryFeeFrom: formatCents(fees.reduce((a, c) => (a < c ? a : c))),
      deliveryFeeTo: formatCents(fees.reduce((a, c) => (a > c ? a : c))),
      referenceData: record.referenceData,
    };
  }
  private async publicProfile(
    record: Prisma.RestaurantProfileModel,
    channel: RestaurantOrderChannel = 'marketplace',
  ) {
    const { branchFulfillment, ...profile } = this.map(record);
    return {
      ...profile,
      ...(branchFulfillment?.length ? {
        onlineBranches: await restaurantOnlineBranches(this.prisma, record.merchantId, {
          ...profile,
          branchFulfillment,
        }, new Date(), channel),
      } : {}),
    };
  }
  async save(merchantId: string, actor: string, body: unknown) {
    const { revision, name, ...settings } = restaurantSettingsSchema.parse(body);
    await this.prisma.$transaction(async (db) => {
      const merchant = await db.merchant.findFirst({
        where: { id: merchantId, activity: 'restaurant' },
        select: { id: true, name: true },
      });
      if (!merchant) throw new NotFoundException('Restaurant was not found.');
      if (settings.branchFulfillment?.length) {
        const count = await db.branch.count({
          where: { merchantId, id: { in: settings.branchFulfillment.map((branch) => branch.branchId) } },
        });
        if (count !== settings.branchFulfillment.length)
          throw new BadRequestException('Choose branches belonging to this restaurant.');
      }
      if (name !== undefined && name !== merchant.name)
        await db.merchant.update({
          where: { id: merchantId },
          data: {
            name,
            profileRevision: { increment: 1 },
            profileUpdatedBy: actor,
            profileUpdatedAt: new Date(),
          },
        });
      const current = await db.restaurantProfile.findUnique({ where: { merchantId } });
      if (current && settings.branchFulfillment?.length === 0 && toRestaurantSettings(current).branchFulfillment?.length)
        throw new BadRequestException('أوقف استقبال الطلبات من آخر فرع بدل حذف إعداداته.');
      if (!current) {
        if (revision !== 0) throw new ConflictException('Reload restaurant settings.');
        const { logoImage, coverImage, branchFulfillment, ...rest } = settings;
        await db.restaurantProfile.create({
          data: {
            ...rest,
            ...(branchFulfillment !== undefined ? { branchFulfillment } : {}),
            ...(logoImage ? { logoImage } : {}),
            ...(coverImage ? { coverImage } : {}),
            merchantId,
            updatedBy: actor,
          },
        });
      } else {
        const { logoImage, coverImage, branchFulfillment, ...rest } = settings;
        const result = await db.restaurantProfile.updateMany({
          where: { merchantId, revision },
          data: {
            ...rest,
            ...(branchFulfillment !== undefined ? { branchFulfillment } : {}),
            logoImage: logoImage ?? Prisma.DbNull,
            coverImage: coverImage ?? Prisma.DbNull,
            updatedBy: actor,
            revision: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('Reload restaurant settings.');
      }
    });
    return this.get(merchantId);
  }
  async list(cursor?: string, term = '') {
    const records = await this.prisma.restaurantProfile.findMany({
      where: {
        published: true,
        merchant: {
          activity: 'restaurant',
          ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}),
        },
      },
      include: { merchant: { select: { name: true, storefrontSlug: true } } },
      orderBy: [{ displayOrder: 'asc' }, { merchantId: 'asc' }],
      take: 25,
      ...(cursor ? { cursor: { merchantId: cursor }, skip: 1 } : {}),
    });
    return {
      items: await Promise.all(records.slice(0, 24).map(async (record) => {
        const { merchant, ...profile } = record;
        return { ...await this.publicProfile(profile), name: merchant.name, slug: merchant.storefrontSlug };
      })),
      nextCursor: records.length > 24 ? records[23]!.merchantId : null,
    };
  }
  async product(slug: string, productId: string) {
    await this.menu(slug);
    const result = await this.catalog.getMarketplaceMenu(slug, undefined, productId);
    if (!result.items[0]) throw new NotFoundException('Product was not found.');
    return result.items[0];
  }
  async menu(slug: string, cursor?: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Restaurant was not found.');
    const profile = await this.get(merchant.id);
    if (!profile.published) throw new NotFoundException('Restaurant was not found.');
    return this.catalog.getMarketplaceMenu(slug, cursor);
  }
  async detail(slug: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { storefrontSlug: slug },
      select: { id: true, name: true },
    });
    if (!merchant) throw new NotFoundException('Restaurant was not found.');
    const record = await this.prisma.restaurantProfile.findUnique({ where: { merchantId: merchant.id } });
    if (!record?.published) throw new NotFoundException('Restaurant was not found.');
    return {
      ...await this.publicProfile(record),
      name: merchant.name,
      slug,
      catalog: await this.catalog.getMarketplaceMenu(slug),
    };
  }
  /** Delivery and pickup options for the restaurant's own storefront checkout.
   * Marketplace publication does not apply here; opening hours and pauses still do. */
  async fulfillment(slug: string) {
    const record = await this.prisma.restaurantProfile.findFirst({
      where: { merchant: { storefrontSlug: slug, activity: 'restaurant' } },
    });
    if (!record) return { deliveryAreas: [] };
    const { deliveryAreas, onlineBranches } = await this.publicProfile(record, 'storefront');
    return { deliveryAreas, onlineBranches };
  }
}
