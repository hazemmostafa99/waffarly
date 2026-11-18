import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@waffarly/database';
import { toRestaurantSettings } from './restaurant-settings.mapper.js';
import { restaurantOperatingState } from './restaurant-hours.js';
import { formatCents, toCents } from '../../common/money/money.js';
import { deliveryBranches, deliveryLocationLabel, deliveryLocations } from '@waffarly/contracts';
import { restaurantOnlineBranches } from './restaurant-branch-fulfillment.js';
import { createHash } from 'node:crypto';

@Injectable()
export class RestaurantOrderPolicyService {
  async assess(
    db: Prisma.TransactionClient,
    merchantId: string,
    fulfillment: 'pickup' | 'delivery',
    subtotal: bigint,
    areaId?: string,
    expectedRevision?: number,
    pickupBranchId?: string,
  ) {
    const record = await db.restaurantProfile.findUnique({ where: { merchantId } });
    // Existing tenant storefronts without a restaurant profile retain their policy.
    if (!record) {
      if (areaId || pickupBranchId || expectedRevision !== undefined)
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
    if (fulfillment === 'delivery' && pickupBranchId)
      throw new BadRequestException('Delivery branches are selected by service area.');
    if (settings.branchFulfillment?.length) {
      const branches = await restaurantOnlineBranches(db, merchantId, settings);
      const location = deliveryLocations.find((entry) => entry.id === areaId);
      if (fulfillment === 'delivery' && !location)
        throw new BadRequestException('اختار منطقة توصيل من القائمة.');
      const route = fulfillment === 'delivery'
        ? deliveryBranches(branches, areaId!).find(({ branch }) => branch.acceptingOrders)
        : undefined;
      const branch = fulfillment === 'delivery' ? route?.branch
        : branches.find((entry) => entry.branchId === pickupBranchId && entry.pickup && entry.acceptingOrders);
      if (!branch)
        throw new ConflictException(fulfillment === 'delivery'
          ? 'مفيش فرع متاح للتوصيل للمنطقة دي دلوقتي.'
          : 'اختار فرع متاح للاستلام.');
      const minimum = route?.area.minimum ?? '0.00';
      if (subtotal < toCents(minimum))
        throw new ConflictException('The delivery minimum has not been reached.');
      const fee = toCents(route?.area.fee ?? '0');
      const receivingBranch = { id: branch.branchId, name: branch.name, address: branch.address };
      const snapshot = {
        revision: settings.revision,
        fulfillment,
        areaId: areaId ?? null,
        areaName: location ? deliveryLocationLabel(location) : null,
        deliveryFee: formatCents(fee),
        minimumDeliveryOrder: minimum,
        timezone: settings.timezone,
        deliveryTimeMinMinutes: route?.area.etaMinutes ?? 0,
        deliveryTimeMaxMinutes: route?.area.etaMinutes ?? 0,
      };
      const quoteKey = createHash('sha256').update(JSON.stringify({ receivingBranch, snapshot })).digest('hex');
      return { fee, snapshot, receivingBranch, quoteKey };
    }
    if (pickupBranchId) throw new BadRequestException('Branch pickup is not configured.');
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
      receivingBranch: null,
      quoteKey: null,
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
