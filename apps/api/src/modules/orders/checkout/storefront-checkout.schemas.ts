/**
 * Checks the details sent when a customer reviews or places a website order.
 */
import { z } from 'zod';
const orderSelectionSchema = z
  .object({
    groupId: z.string().uuid(),
    optionIds: z.array(z.string().uuid()).max(100),
    optionQuantities: z
      .array(
        z
          .object({ optionId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict();

export const createOrderSchema = z
  .object({
    requestId: z.uuid().optional(),
    reviewedTotal: z
      .string()
      .regex(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/)
      .optional(),
    discountCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/)
      .optional(),
    deliveryAreaId: z.string().trim().min(1).max(80).optional(),
    restaurantSettingsRevision: z.number().int().positive().optional(),
    customerName: z.string().trim().min(2).max(120),
    customerPhone: z
      .string()
      .trim()
      .min(7)
      .max(32)
      .regex(/^[+\d\s().-]+$/)
      .refine((phone) => phone.replace(/\D/g, '').length >= 7),
    fulfillmentType: z.enum(['pickup', 'delivery']),
    deliveryAddress: z.string().trim().min(8).max(1000).optional(),
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid(),
            variantId: z.string().uuid().optional(),
            selections: z.array(orderSelectionSchema).max(30),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((order, context) => {
    if (order.fulfillmentType === 'delivery' && !order.deliveryAddress?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['deliveryAddress'],
        message: 'A delivery address is required for delivery orders.',
      });
    }
  });

export const updateStatusSchema = z.object({ status: z.enum(['accepted', 'rejected']) }).strict();
export const posOrderPageSchema = z
  .object({
    branchId: z.string().uuid(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const posActiveSalesPageSchema = posOrderPageSchema.extend({
  search: z.string().trim().max(120).optional(),
  mode: z.enum(['active', 'history']).default('active'),
});
