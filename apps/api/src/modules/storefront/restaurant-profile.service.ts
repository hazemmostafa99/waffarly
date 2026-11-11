import { Prisma } from '@waffarly/database';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { restaurantSettingsSchema } from './restaurant.schemas.js';
import { restaurantOperatingState } from './restaurant-hours.js';
import { CatalogQueryService } from '../catalog/index.js';
import { formatCents, toCents } from '../../common/money/money.js';

@Injectable()
export class RestaurantProfileService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogQueryService) private readonly catalog: CatalogQueryService) {}
  async get(merchantId: string) {
    const record = await this.prisma.restaurantProfile.findUnique({ where: { merchantId } });
    if (!record) throw new NotFoundException('Restaurant profile was not found.');
    return this.map(record);
  }
  private map(record: Prisma.RestaurantProfileGetPayload<{}>) {
    const { merchantId, updatedBy, updatedAt, referenceData, ...fields } = record;
    const settings = restaurantSettingsSchema.parse({ ...fields, deliveryFee: record.deliveryFee.toFixed(2), minimumDeliveryOrder: record.minimumDeliveryOrder.toFixed(2) });
    const fees = settings.deliveryAreas.length ? settings.deliveryAreas.map((area) => toCents(area.fee)) : [toCents(settings.deliveryFee)];
    return { ...settings, merchantId, updatedAt: updatedAt.toISOString(),
      ...restaurantOperatingState(settings),
      deliveryFeeFrom: formatCents(fees.reduce((a, c) => a < c ? a : c)),
      deliveryFeeTo: formatCents(fees.reduce((a, c) => a > c ? a : c)), referenceData };
  }
  async save(merchantId: string, actor: string, body: unknown) {
    const { revision, ...settings } = restaurantSettingsSchema.parse(body);
    await this.prisma.$transaction(async (db) => {
      const merchant = await db.merchant.findFirst({ where: { id: merchantId, activity: 'restaurant' }, select: { id: true } });
      if (!merchant) throw new NotFoundException('Restaurant was not found.');
      const current = await db.restaurantProfile.findUnique({ where: { merchantId } });
      if (!current) {
        if (revision !== 0) throw new ConflictException('Reload restaurant settings.');
        const { logoImage, coverImage, ...rest } = settings;
        await db.restaurantProfile.create({ data: { ...rest, ...(logoImage ? { logoImage } : {}), ...(coverImage ? { coverImage } : {}), merchantId, updatedBy: actor } });
      } else {
        const { logoImage, coverImage, ...rest } = settings;
        const result = await db.restaurantProfile.updateMany({ where: { merchantId, revision },
          data: { ...rest, logoImage: logoImage ?? Prisma.DbNull, coverImage: coverImage ?? Prisma.DbNull, updatedBy: actor, revision: { increment: 1 } } });
        if (result.count !== 1) throw new ConflictException('Reload restaurant settings.');
      }
    });
    return this.get(merchantId);
  }
  async list(cursor?: string, term = '') {
    const records = await this.prisma.restaurantProfile.findMany({ where: { published: true, merchant: { activity: 'restaurant', ...(term ? { name: { contains: term, mode: 'insensitive' } } : {}) } },
      include: { merchant: { select: { name: true, storefrontSlug: true } } }, orderBy: [{ displayOrder: 'asc' }, { merchantId: 'asc' }],
      take: 25, ...(cursor ? { cursor: { merchantId: cursor }, skip: 1 } : {}) });
    return { items: records.slice(0, 24).map((record) => {
      const { merchant, ...profile } = record;
      return { ...this.map(profile), name: merchant.name, slug: merchant.storefrontSlug };
    }), nextCursor: records.length > 24 ? records[23]!.merchantId : null };
  }
  async product(slug: string, productId: string) {
    await this.menu(slug);
    const result = await this.catalog.getMarketplaceMenu(slug, undefined, productId);
    if (!result.items[0]) throw new NotFoundException('Product was not found.');
    return result.items[0];
  }
  async menu(slug: string, cursor?: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { storefrontSlug: slug }, select: { id: true } });
    if (!merchant) throw new NotFoundException('Restaurant was not found.');
    const profile = await this.get(merchant.id);
    if (!profile.published) throw new NotFoundException('Restaurant was not found.');
    return this.catalog.getMarketplaceMenu(slug, cursor);
  }
  async detail(slug: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { storefrontSlug: slug }, select: { id: true, name: true } });
    if (!merchant) throw new NotFoundException('Restaurant was not found.');
    const profile = await this.get(merchant.id);
    if (!profile.published) throw new NotFoundException('Restaurant was not found.');
    return { ...profile, name: merchant.name, slug, catalog: await this.catalog.getMarketplaceMenu(slug) };
  }
}
