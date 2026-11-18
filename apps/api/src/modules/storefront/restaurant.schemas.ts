import { z } from 'zod';
import { deliveryLocations } from '@waffarly/contracts';
const money = z.string().regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const period = z
  .object({ open: clock, close: clock })
  .strict()
  .refine((value) => value.open !== value.close, 'Use alwaysOpen for full-day service.');
const image = z
  .object({ src: z.url().refine((value) => /^https?:\/\//.test(value)), alt: z.string().max(500) })
  .strict()
  .nullable();
const locationId = z.string().refine((id) => deliveryLocations.some((location) => location.id === id));
const branchSettings = z.object({
  branchId: z.uuid(),
  locationId,
  paused: z.boolean(),
  pickup: z.boolean(),
  delivery: z.boolean(),
  dailyHours: period.nullable(),
  areas: z.array(z.object({
    locationId: z.string().min(1).max(80),
    governorate: z.string().trim().min(1).max(100).optional(),
    locality: z.string().trim().min(1).max(100).optional(),
    area: z.string().trim().min(1).max(100).optional(),
    fee: money,
    minimum: money,
    etaMinutes: z.number().int().min(1).max(1440),
    priority: z.number().int().min(1).max(1000),
  }).strict().transform(({ governorate, locality, area, ...fields }) => ({
    ...fields,
    ...(governorate !== undefined ? { governorate } : {}),
    ...(locality !== undefined ? { locality } : {}),
    ...(area !== undefined ? { area } : {}),
  }))).max(100),
}).strict().refine((branch) => {
  return (!branch.delivery || branch.areas.length > 0)
    && new Set(branch.areas.map((area) => area.locationId)).size === branch.areas.length
    && branch.areas.every((area) => {
      const hasCustomLocation = area.governorate && area.locality && area.area;
      const hasCatalogLocation = deliveryLocations.some((location) => location.id === area.locationId);
      return Boolean(hasCustomLocation || hasCatalogLocation);
    });
}, 'Choose distinct delivery destinations from the catalog or provide a complete custom destination.');
export const restaurantSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().max(1000),
    cuisines: z.array(z.string().trim().min(1).max(80)).max(20),
    logoImage: image,
    coverImage: image,
    published: z.boolean(),
    displayOrder: z.number().int().min(0),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
    alwaysOpen: z.boolean(),
    openingHours: z
      .array(
        z.object({ day: z.number().int().min(0).max(6), periods: z.array(period).max(8) }).strict(),
      )
      .max(7)
      .refine((days) => new Set(days.map((day) => day.day)).size === days.length),
    scheduleExceptions: z
      .array(z.object({ date: z.iso.date(), periods: z.array(period).max(8) }).strict())
      .max(366)
      .refine((days) => new Set(days.map((day) => day.date)).size === days.length),
    ordersPaused: z.boolean(),
    pauseReason: z.string().max(500).nullable(),
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    deliveryFee: money,
    minimumDeliveryOrder: money,
    deliveryTimeMinMinutes: z.number().int().min(0).max(1440),
    deliveryTimeMaxMinutes: z.number().int().min(0).max(1440),
    deliveryAreas: z
      .array(
        z
          .object({ id: z.string().min(1).max(80), name: z.string().min(1).max(160), fee: money })
          .strict(),
      )
      .max(100)
      .refine((areas) => new Set(areas.map((area) => area.id)).size === areas.length),
    branchFulfillment: z.array(branchSettings).max(100).refine(
      (branches) => new Set(branches.map((branch) => branch.branchId)).size === branches.length,
    ).optional(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (value) => value.deliveryTimeMinMinutes <= value.deliveryTimeMaxMinutes,
    'Invalid delivery time range.',
  );
