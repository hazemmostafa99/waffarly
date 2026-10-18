import { z } from 'zod';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';

const uuid = z.string().uuid();
const tableCode = z.string().trim().min(1).max(32);
const amount = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);

export const ownerPosDiningTableListSchema = z
  .object({
    branchId: uuid.optional(),
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(['active', 'inactive', 'all']).default('active'),
  })
  .strict();
export type OwnerPosDiningTableListQuery = z.infer<typeof ownerPosDiningTableListSchema>;

export const posDiningTableListSchema = z.object({ branchId: uuid }).strict();

export const createPosDiningTableSchema = z
  .object({
    branchId: uuid,
    code: tableCode,
    capacity: z.number().int().min(1).max(100).default(2),
  })
  .strict();

export const updatePosDiningTableSchema = z
  .object({
    revision: z.number().int().positive().max(2_147_483_646),
    code: tableCode,
    capacity: z.number().int().min(1).max(100),
    active: z.boolean(),
  })
  .strict();

export const movePosDiningSessionSchema = z
  .object({ requestId: uuid, revision: z.number().int().positive(), tableId: uuid })
  .strict();

const splitEnvelope = { requestId: uuid, revision: z.number().int().positive() };
const itemSplitSchema = z
  .object({
    ...splitEnvelope,
    method: z.literal('items'),
    checks: z
      .array(
        z
          .object({
            lines: z
              .array(
                z.object({ orderLineId: uuid, quantity: z.number().int().min(1).max(99) }).strict(),
              )
              .min(1)
              .max(30),
          })
          .strict(),
      )
      .min(2)
      .max(20),
  })
  .strict()
  .superRefine((request, context) => {
    for (const [index, check] of request.checks.entries()) {
      if (new Set(check.lines.map((line) => line.orderLineId)).size !== check.lines.length) {
        context.addIssue({
          code: 'custom',
          path: ['checks', index, 'lines'],
          message: 'A check cannot allocate the same order line twice.',
        });
      }
    }
  });

const equalSplitSchema = z
  .object({
    ...splitEnvelope,
    method: z.literal('equal'),
    checkCount: z.number().int().min(2).max(20),
  })
  .strict();

const customSplitSchema = z
  .object({
    ...splitEnvelope,
    method: z.literal('custom'),
    amounts: z.array(amount).min(2).max(20),
  })
  .strict();

export const splitPosOrderChecksSchema = z.discriminatedUnion('method', [
  itemSplitSchema,
  equalSplitSchema,
  customSplitSchema,
]);

export function parseOwnerPosDiningTableList(input: unknown): OwnerPosDiningTableListQuery {
  return parseRequest(ownerPosDiningTableListSchema, input);
}

export function parsePosDiningTableList(input: unknown) {
  return parseRequest(posDiningTableListSchema, input);
}

export function parseMovePosDiningSession(input: unknown) {
  return parseRequest(movePosDiningSessionSchema, input);
}
