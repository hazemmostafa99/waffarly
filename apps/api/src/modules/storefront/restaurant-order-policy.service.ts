import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@waffarly/database';
import { toRestaurantSettings } from './restaurant-settings.mapper.js';
import { restaurantOperatingState } from './restaurant-hours.js';
import { formatCents, toCents } from '../../common/money/money.js';

@Injectable()
export class RestaurantOrderPolicyService {
  async assess(
    db: Prisma.TransactionClient,
    merchantId: string,
    fulfillment: 'pickup' | 'delivery',
    subtotal: bigint,
    areaId?: string,
    expectedRevision?: number,
  ) {
    const record = await db.restaurantProfile.findUnique({ where: { merchantId } });
    // Existing tenant storefronts without a restaurant profile retain their policy.
    if (!record) {
      if (areaId || expectedRevision !== undefined)
        throw new BadRequestException('Restaurant settings are unavailable.');
      return null;
    }
    const settings = toRestaurantSettings(record);
    if (expectedRevision !== undefined && expectedRevision !== settings.revision)
      throw new ConflictException(
        'Restaurant settings changed. Review delivery and confirm again.',
      );
    if (!restaurantOperatingState(settings).acceptingOrders)
      throw new ConflictException('The restaurant is not accepting orders now.');
    if (fulfillment === 'delivery' ? !settings.deliveryEnabled : !settings.pickupEnabled)
      throw new ConflictException('This fulfillment method is unavailable.');
    if (fulfillment === 'pickup' && areaId)
      throw new BadRequestException('Pickup does not use a delivery area.');
    let fee = 0n;
    let areaName: string | null = null;
    if (fulfillment === 'delivery') {
      if (subtotal < toCents(settings.minimumDeliveryOrder))
        throw new ConflictException('The delivery minimum has not been reached.');
      if (settings.deliveryAreas.length) {
        const area = settings.deliveryAreas.find((entry) => entry.id === areaId);
        if (!area) throw new BadRequestException('Choose a supported delivery area.');
        fee = toCents(area.fee);
        areaName = area.name;
      } else {
        if (areaId) throw new BadRequestException('Unknown delivery area.');
        fee = toCents(settings.deliveryFee);
      }
    }
    return {
      fee,
      snapshot: {
        revision: settings.revision,
        fulfillment,
        areaId: areaId ?? null,
        areaName,
        deliveryFee: formatCents(fee),
        minimumDeliveryOrder: settings.minimumDeliveryOrder,
        timezone: settings.timezone,
        deliveryTimeMinMinutes: settings.deliveryTimeMinMinutes,
        deliveryTimeMaxMinutes: settings.deliveryTimeMaxMinutes,
      },
    };
  }
}
