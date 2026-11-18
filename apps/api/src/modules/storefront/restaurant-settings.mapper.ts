/** Prepares saved restaurant settings for use in browsing and checkout. */
import type { Prisma } from '@waffarly/database';
import { restaurantSettingsSchema } from './restaurant.schemas.js';

export function toRestaurantSettings(record: Prisma.RestaurantProfileModel) {
  // Keep bookkeeping fields outside the settings, as the strict schema expects.
  const fields = Object.fromEntries(
    Object.entries(record).filter(
      ([key]) => !['merchantId', 'updatedBy', 'updatedAt', 'referenceData'].includes(key),
    ),
  );
  return restaurantSettingsSchema.parse({
    ...fields,
    deliveryFee: record.deliveryFee.toFixed(2),
    minimumDeliveryOrder: record.minimumDeliveryOrder.toFixed(2),
  });
}
