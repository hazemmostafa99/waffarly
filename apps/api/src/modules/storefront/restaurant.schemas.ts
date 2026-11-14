import { z } from 'zod';
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
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (value) => value.deliveryTimeMinMinutes <= value.deliveryTimeMaxMinutes,
    'Invalid delivery time range.',
  );
