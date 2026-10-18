import { ConflictException } from '@nestjs/common';
import type { CatalogProductModifierGroupAssignmentFields } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { productInclude, toProductResponse } from '../product.mapper.js';
import { inventoryConfigurationMatches } from '../product-inventory.rules.js';
import type { ProductPatch } from '../product.types.js';

function assignmentConsumption(groups: CatalogProductModifierGroupAssignmentFields[]) {
  const effects = (rows: NonNullable<(typeof groups)[number]['options'][number]['effects']>) =>
    rows
      .map((effect) => ({
        ...effect,
        quantity: effect.quantity.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''),
      }))
      .sort((a, b) => a.stockItemId.localeCompare(b.stockItemId));
  return groups
    .map((group) => ({
      modifierGroupId: group.modifierGroupId,
      selectionMode: group.selectionMode,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      variantOverrides: (group.variantOverrides ?? [])
        .filter((override) => !override.available)
        .sort((a, b) => a.variantId.localeCompare(b.variantId)),
      options: group.options
        .map((option) => ({
          optionId: option.optionId,
          defaultSelected: option.defaultSelected,
          maxQuantity: option.maxQuantity ?? 1,
          effects: effects(option.effects ?? []),
          variantOverrides: (option.variantOverrides ?? [])
            .filter((override) => !override.available || override.effects !== undefined)
            .map((override) => ({
              variantId: override.variantId,
              available: override.available,
              ...(override.effects === undefined ? {} : { effects: effects(override.effects) }),
            }))
            .sort((a, b) => a.variantId.localeCompare(b.variantId)),
        }))
        .sort((a, b) => a.optionId.localeCompare(b.optionId)),
    }))
    .sort((a, b) => a.modifierGroupId.localeCompare(b.modifierGroupId));
}

export async function assertPendingRecipeUnchanged(
  tx: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  input: ProductPatch,
): Promise<void> {
  const pending = await tx.storefrontOrderLine.findFirst({
    where: {
      merchantId,
      productId,
      stockHandling: 'recipe_acceptance',
      stockRequirementsFrozenAt: null,
      order: { is: { status: 'pending' } },
    },
    select: { id: true },
  });
  if (!pending) return;
  const fail = () => {
    throw new ConflictException(
      'Consumption configuration and selection identities cannot change while recipe orders are pending.',
    );
  };
  if (input.modifierGroups !== undefined) fail();
  const product = toProductResponse(
    await tx.product.findFirstOrThrow({
      where: { id: productId, merchantId },
      include: productInclude,
    }),
  );
  if (
    input.inventoryConfiguration !== undefined &&
    (!input.inventoryConfiguration ||
      !inventoryConfigurationMatches(input.inventoryConfiguration, product.inventoryConfiguration))
  )
    fail();
  if (
    input.variants !== undefined &&
    JSON.stringify(input.variants.map((variant) => variant.id).sort()) !==
      JSON.stringify(product.variants.map((variant) => variant.id).sort())
  )
    fail();
  if (input.modifierGroupAssignments !== undefined) {
    const current = product.modifierGroups.map((group) => ({
      ...group,
      options: group.options.map((option) => ({ ...option, optionId: option.id })),
    }));
    if (
      JSON.stringify(assignmentConsumption(input.modifierGroupAssignments)) !==
      JSON.stringify(
        assignmentConsumption(current as CatalogProductModifierGroupAssignmentFields[]),
      )
    )
      fail();
  }
}
