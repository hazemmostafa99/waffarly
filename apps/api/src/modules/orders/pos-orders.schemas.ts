import type { CreatePosOrderRequest, PosOrderQuoteRequest } from '@waffarly/contracts';
import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';

const selectionSchema = z
  .object({
    groupId: z.string().uuid(),
    optionIds: z.array(z.string().uuid()).max(100),
    optionQuantities: z
      .array(z.object({ optionId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }).strict())
      .max(100)
      .optional(),
  })
  .strict();

const quoteLineSchema = z
  .object({
    lineId: z.string().uuid(),
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    selections: z.array(selectionSchema).max(30),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();

const quoteSchema = z
  .object({ items: z.array(quoteLineSchema).min(1).max(30) })
  .strict()
  .superRefine((request, context) => {
    if (new Set(request.items.map((item) => item.lineId)).size !== request.items.length) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Cart line IDs must be unique.',
      });
    }
  });

const createLineSchema = quoteLineSchema
  .extend({
    expectedProductRevision: z.number().int().min(1),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^[+\d\s().-]+$/)
  .refine((phone) => phone.replace(/\D/g, '').length >= 7);

const createOrderSchema = z
  .object({
    requestId: z.string().uuid(),
    registerId: z.string().uuid(),
    fulfillmentType: z.enum(['dine_in', 'takeaway', 'delivery']),
    tableId: z.string().uuid().optional(),
    customerName: z.string().trim().min(2).max(120).optional(),
    customerPhone: phoneSchema.optional(),
    deliveryAddress: z.string().trim().min(8).max(1000).optional(),
    items: z.array(createLineSchema).min(1).max(30),
  })
  .strict()
  .superRefine((request, context) => {
    if (new Set(request.items.map((item) => item.lineId)).size !== request.items.length) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Cart line IDs must be unique.',
      });
    }
    if (request.fulfillmentType === 'delivery') {
      if (!request.customerName?.trim()) {
        context.addIssue({
          code: 'custom',
          path: ['customerName'],
          message: 'A customer name is required for delivery.',
        });
      }
      if (!request.customerPhone) {
        context.addIssue({
          code: 'custom',
          path: ['customerPhone'],
          message: 'A customer phone is required for delivery.',
        });
      }
      if (!request.deliveryAddress?.trim()) {
        context.addIssue({
          code: 'custom',
          path: ['deliveryAddress'],
          message: 'A delivery address is required for delivery.',
        });
      }
    }
    if (request.fulfillmentType === 'dine_in' && !request.tableId) {
      context.addIssue({
        code: 'custom',
        path: ['tableId'],
        message: 'Choose a table for dine-in orders.',
      });
    }
    if (request.fulfillmentType !== 'dine_in' && request.tableId) {
      context.addIssue({
        code: 'custom',
        path: ['tableId'],
        message: 'Tables can only be assigned to dine-in orders.',
      });
    }
  });

export function parsePosOrderQuoteRequest(input: unknown): PosOrderQuoteRequest {
  return parseRequest(quoteSchema, input);
}

export function parseCreatePosOrderRequest(input: unknown): CreatePosOrderRequest {
  return parseRequest(createOrderSchema, input);
}
