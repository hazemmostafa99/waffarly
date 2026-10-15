import { BadRequestException } from '@nestjs/common';
import type {
  CatalogModifierEffectFields,
  CatalogProductModifierGroupAssignmentFields,
  StockBaseUnit,
} from '@waffarly/contracts';
import { Prisma } from '@waffarly/database';
import { parseRequest } from '../../../../common/http/zod-validation.pipe.js';
import { modifierAssignmentsSchema } from '../product.schemas.js';
import { convertToBaseQuantity, normalizeStockQuantity } from '../../../inventory/index.js';

type Tx = Prisma.TransactionClient;

export async function replaceModifierDetails(
  tx: Tx,
  merchantId: string,
  productId: string,
  groups: CatalogProductModifierGroupAssignmentFields[],
): Promise<void> {
  parseRequest(modifierAssignmentsSchema, groups);
  const variants = await tx.productVariant.findMany({
    where: { merchantId, productId },
    select: { id: true },
  });
  const variantIds = new Set(variants.map((variant) => variant.id));
  const assignments = await tx.productModifierGroupAssignment.findMany({
    where: { merchantId, productId },
    select: { id: true, modifierGroupId: true },
  });
  const effectFields = groups.flatMap((group) =>
    group.options.flatMap((option) => [
      ...(option.effects ?? []),
      ...(option.variantOverrides ?? []).flatMap((override) => override.effects ?? []),
    ]),
  );
  const itemIds = [...new Set(effectFields.map((effect) => effect.stockItemId))];
  if (itemIds.length) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "stock_items" WHERE "merchantId" = ${merchantId}::uuid AND "id" IN (${Prisma.join(itemIds.map((id) => Prisma.sql`${id}::uuid`))}) AND "archivedAt" IS NULL ORDER BY "id" FOR SHARE`,
    );
    if (locked.length !== itemIds.length)
      throw new BadRequestException(
        'Modifier effects need active stock items owned by this merchant.',
      );
  }
  const items = await tx.stockItem.findMany({
    where: { merchantId, id: { in: itemIds }, archivedAt: null },
    include: { units: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));
  if (items.length !== itemIds.length)
    throw new BadRequestException(
      'Modifier effects need active stock items owned by this merchant.',
    );

  const validateVariants = (overrides: Array<{ variantId: string }>) => {
    if (
      overrides.length > 100 ||
      new Set(overrides.map((item) => item.variantId)).size !== overrides.length ||
      overrides.some((item) => !variantIds.has(item.variantId))
    ) {
      throw new BadRequestException(
        'Variant overrides must uniquely reference variants of this product.',
      );
    }
  };
  for (const group of groups) {
    const assignment = assignments.find((item) => item.modifierGroupId === group.modifierGroupId);
    if (!assignment) throw new BadRequestException('Modifier assignment was not found.');
    const assignmentId = assignment.id;
    validateVariants(group.variantOverrides ?? []);
    await tx.productModifierGroupVariant.deleteMany({ where: { assignmentId, merchantId } });
    await tx.productModifierGroupVariant.createMany({
      data: (group.variantOverrides ?? []).map((override) => ({
        ...override,
        assignmentId,
        productId,
        merchantId,
      })),
    });
    for (const option of group.options) {
      validateVariants(option.variantOverrides ?? []);
      const optionId = option.optionId;
      await tx.productModifierOptionVariant.deleteMany({
        where: { assignmentId, optionId, merchantId },
      });
      await tx.productModifierEffect.deleteMany({ where: { assignmentId, optionId, merchantId } });
      await tx.productModifierOptionVariant.createMany({
        data: (option.variantOverrides ?? []).map((override) => ({
          assignmentId,
          optionId,
          productId,
          merchantId,
          variantId: override.variantId,
          available: override.available,
          priceAdjustment: override.priceAdjustment ?? null,
          effectsOverride: override.effects !== undefined,
        })),
      });
      const effectRows = (effects: CatalogModifierEffectFields[], variantId: string | null) => {
        if (effects.length > 100)
          throw new BadRequestException('An option can affect at most 100 ingredients.');
        const ids = effects.map((effect) => effect.stockItemId);
        if (new Set(ids).size !== ids.length)
          throw new BadRequestException('Ingredient effects must be unique per stock item.');
        return effects.map((effect, position) => {
          const item = itemById.get(effect.stockItemId);
          if (!item || !['ADD', 'REMOVE'].includes(effect.direction))
            throw new BadRequestException('Modifier effect is invalid.');
          const quantity = normalizeStockQuantity(effect.quantity);
          const baseUnit = item.baseUnit as StockBaseUnit;
          const baseQuantity = convertToBaseQuantity(
            quantity,
            effect.unitCode,
            baseUnit,
            item.units.map((unit) => ({
              code: unit.code,
              name: unit.name,
              baseQuantity: unit.baseQuantity.toFixed(6),
            })),
          );
          return {
            assignmentId,
            optionId,
            productId,
            merchantId,
            variantId,
            stockItemId: item.id,
            direction: effect.direction,
            unitCode: effect.unitCode,
            quantity,
            baseQuantity,
            baseUnit,
            position,
          };
        });
      };
      await tx.productModifierEffect.createMany({
        data: [
          ...effectRows(option.effects ?? [], null),
          ...(option.variantOverrides ?? []).flatMap((override) =>
            effectRows(override.effects ?? [], override.variantId),
          ),
        ],
      });
    }
  }
}

/** Validate the complete saved state, including unchanged groups after variant/mode edits. */
export async function assertSavedModifierDetails(
  tx: Tx,
  merchantId: string,
  productId: string,
): Promise<void> {
  const product = await tx.product.findFirstOrThrow({
    where: { merchantId, id: productId },
    select: {
      inventoryConfiguration: { select: { mode: true } },
      variants: { select: { id: true } },
      modifierGroups: {
        include: {
          variantOverrides: true,
          options: { include: { variantOverrides: true, effects: true } },
        },
      },
    },
  });
  for (const group of product.modifierGroups) {
    if (
      group.options.some(
        (option) =>
          option.effects.length ||
          option.variantOverrides.some((override) => override.effectsOverride),
      ) &&
      product.inventoryConfiguration?.mode !== 'RECIPE'
    ) {
      throw new BadRequestException('Ingredient effects are supported only for RECIPE products.');
    }
    for (const variantId of product.variants.length
      ? product.variants.map((variant) => variant.id)
      : [null]) {
      if (
        group.variantOverrides.find((override) => override.variantId === variantId)?.available ===
        false
      )
        continue;
      const available = group.options.filter(
        (option) =>
          option.variantOverrides.find((override) => override.variantId === variantId)
            ?.available !== false,
      );
      if (
        available.length < group.minSelections ||
        available.filter((option) => option.defaultSelected).length > group.maxSelections
      ) {
        throw new BadRequestException(
          'Variant modifier availability cannot satisfy the group selection bounds.',
        );
      }
    }
  }
}
