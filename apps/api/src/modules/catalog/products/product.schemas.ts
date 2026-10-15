import { z } from 'zod';
import { MAX_PRODUCT_PRICE, isValidProductPrice } from '../catalog.constants.js';
export const availability = z.enum(['available', 'unavailable']);

export const modifierOptionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  priceAdjustment: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
  defaultSelected: z.boolean(),
  position: z.number().int().nonnegative(),
});

export const modifierGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional(),
    selectionMode: z.enum(['single', 'multiple']),
    minSelections: z.number().int().nonnegative(),
    maxSelections: z.number().int().positive(),
    position: z.number().int().nonnegative(),
    options: z.array(modifierOptionSchema).min(1).max(100),
  })
  .superRefine((group, context) => {
    if (group.minSelections > group.maxSelections) {
      context.addIssue({
        code: 'custom',
        path: ['minSelections'],
        message: 'Minimum selections cannot exceed maximum selections.',
      });
    }
    if (group.maxSelections > group.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['maxSelections'],
        message: 'Maximum selections cannot exceed the number of options.',
      });
    }
    if (group.selectionMode === 'single' && group.maxSelections !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['maxSelections'],
        message: 'Single-choice groups can select at most one option.',
      });
    }
    const defaults = group.options.filter((option) => option.defaultSelected).length;
    if (defaults > group.maxSelections) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Default selections cannot exceed the group selection limit.',
      });
    }
    if (new Set(group.options.map((option) => option.position)).size !== group.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Option positions must be unique within a group.',
      });
    }
  });

export const modifierGroupsSchema = z
  .array(modifierGroupSchema)
  .max(30)
  .superRefine((groups, context) => {
    if (new Set(groups.map((group) => group.position)).size !== groups.length) {
      context.addIssue({ code: 'custom', message: 'Modifier group positions must be unique.' });
    }
  });

export const productVariantsSchema = z
  .array(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(160),
      sku: z.string().trim().max(80).optional(),
      barcode: z.string().trim().max(80).optional(),
      price: z
        .string()
        .refine(
          isValidProductPrice,
          `Variant price must be between 0.01 and ${MAX_PRODUCT_PRICE} EGP with at most two decimals.`,
        ),
      stockQuantity: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
      availability,
      position: z.number().int().nonnegative(),
      attributes: z
        .array(
          z
            .object({
              attributeId: z.string().uuid().optional(),
              valueId: z.string().uuid().optional(),
              name: z.string().trim().min(1).max(120),
              value: z.string().trim().min(1).max(120),
            })
            .strict(),
        )
        .max(10)
        .optional(),
    }),
  )
  .max(100)
  .superRefine((variants, context) => {
    const positions = new Set<number>();
    const skus = new Set<string>();
    const barcodes = new Set<string>();
    variants.forEach((variant, index) => {
      if (positions.has(variant.position)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'position'],
          message: 'Variant positions must be unique.',
        });
      }
      positions.add(variant.position);
      const sku = variant.sku?.toLocaleLowerCase();
      const barcode = variant.barcode?.toLocaleLowerCase();
      if (sku && skus.has(sku)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'sku'],
          message: 'Variant SKUs must be unique.',
        });
      }
      if (barcode && barcodes.has(barcode)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'barcode'],
          message: 'Variant barcodes must be unique.',
        });
      }
      if (sku) skus.add(sku);
      if (barcode) barcodes.add(barcode);
    });
  });

export const modifierAssignmentSchema = z
  .object({
    modifierGroupId: z.string().uuid(),
    selectionMode: z.enum(['single', 'multiple']),
    minSelections: z.number().int().nonnegative(),
    maxSelections: z.number().int().positive(),
    position: z.number().int().nonnegative(),
    options: z
      .array(
        z
          .object({
            optionId: z.string().uuid(),
            priceAdjustment: z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/),
            defaultSelected: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((group, context) => {
    if (group.minSelections > group.maxSelections) {
      context.addIssue({
        code: 'custom',
        path: ['minSelections'],
        message: 'Minimum selections cannot exceed maximum selections.',
      });
    }
    if (group.selectionMode === 'single' && group.maxSelections !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['maxSelections'],
        message: 'Single-choice groups can select at most one option.',
      });
    }
    if (new Set(group.options.map((option) => option.optionId)).size !== group.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Modifier options must be unique within a group.',
      });
    }
  });

export const modifierAssignmentsSchema = z
  .array(modifierAssignmentSchema)
  .max(30)
  .superRefine((groups, context) => {
    if (new Set(groups.map((group) => group.position)).size !== groups.length) {
      context.addIssue({ code: 'custom', message: 'Modifier group positions must be unique.' });
    }
    if (new Set(groups.map((group) => group.modifierGroupId)).size !== groups.length) {
      context.addIssue({ code: 'custom', message: 'A modifier group can only be assigned once.' });
    }
  });

export const inventoryConfigurationSchema = z
  .object({
    mode: z.enum(['DIRECT', 'RECIPE']),
    targets: z
      .array(
        z
          .object({
            variantId: z.string().uuid().nullable(),
            components: z
              .array(
                z
                  .object({
                    stockItemId: z.string().uuid(),
                    unitCode: z.string().trim().min(1).max(32),
                    quantity: z.string().regex(/^(0|[1-9]\d{0,11})(?:\.\d{1,6})?$/),
                  })
                  .strict(),
              )
              .min(1)
              .max(100),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const productFields = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  basePrice: z
    .string()
    .refine(
      isValidProductPrice,
      `Base price must be between 0.01 and ${MAX_PRODUCT_PRICE} EGP with at most two decimals.`,
    ),
  availability,
  imageAssetIds: z.array(z.string().uuid()).min(1).max(10),
  primaryImageAssetId: z.string().uuid().optional(),
  categoryIds: z.array(z.string().uuid()).min(1),
  modifierGroups: modifierGroupsSchema.optional(),
  modifierGroupAssignments: modifierAssignmentsSchema.optional(),
  variants: productVariantsSchema.optional(),
  inventoryConfiguration: inventoryConfigurationSchema.nullable().optional(),
};

export const createSchema = z.object(productFields);

export const updateSchema = z.object(productFields).partial().extend({
  revision: z.number().int().positive(),
});

export const revisionSchema = z.object({ revision: z.number().int().positive() });

export const attachModifierGroupSchema = modifierAssignmentSchema
  .safeExtend({ revision: z.number().int().positive() })
  .strict();
