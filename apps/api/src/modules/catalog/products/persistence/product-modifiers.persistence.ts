import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@waffarly/database';
import { randomUUID } from 'node:crypto';
import type { ProductInput } from '../product.types.js';
export async function createLegacyModifierGroups(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  groups: NonNullable<ProductInput['modifierGroups']>,
): Promise<void> {
  for (const group of groups) {
    const modifierGroupId = randomUUID();
    const options = group.options.map((option) => ({ ...option, id: randomUUID() }));
    await transaction.modifierGroup.create({
      data: {
        id: modifierGroupId,
        merchantId,
        name: group.name.trim(),
        description: group.description?.trim() || null,
        options: {
          create: options.map((option) => ({
            id: option.id,
            name: option.name.trim(),
            position: option.position,
          })),
        },
      },
    });
    const assignment = await transaction.productModifierGroupAssignment.create({
      data: {
        productId,
        modifierGroupId,
        merchantId,
        selectionMode: group.selectionMode,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        position: group.position,
      },
      select: { id: true },
    });
    await transaction.productModifierGroupAssignmentOption.createMany({
      data: options.map((option) => ({
        assignmentId: assignment.id,
        modifierGroupId,
        optionId: option.id,
        merchantId,
        priceAdjustment: option.priceAdjustment,
        defaultSelected: option.defaultSelected,
      })),
    });
  }
}

export async function createModifierAssignments(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  assignments: NonNullable<ProductInput['modifierGroupAssignments']>,
): Promise<void> {
  await assertAssignmentReferences(transaction, merchantId, assignments);
  for (const item of assignments) {
    const assignment = await transaction.productModifierGroupAssignment.create({
      data: {
        productId,
        modifierGroupId: item.modifierGroupId,
        merchantId,
        selectionMode: item.selectionMode,
        minSelections: item.minSelections,
        maxSelections: item.maxSelections,
        position: item.position,
      },
      select: { id: true },
    });
    await transaction.productModifierGroupAssignmentOption.createMany({
      data: item.options.map((option) => ({
        assignmentId: assignment.id,
        modifierGroupId: item.modifierGroupId,
        optionId: option.optionId,
        merchantId,
        maxQuantity: option.maxQuantity ?? 1,
        priceAdjustment: option.priceAdjustment,
        defaultSelected: option.defaultSelected,
      })),
    });
  }
}

export async function replaceModifierAssignments(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  productId: string,
  assignments: NonNullable<ProductInput['modifierGroupAssignments']>,
): Promise<void> {
  await assertAssignmentReferences(transaction, merchantId, assignments);
  const current = await transaction.productModifierGroupAssignment.findMany({
    where: { productId, merchantId },
    select: { id: true, modifierGroupId: true },
  });
  const byGroupId = new Map(current.map((assignment) => [assignment.modifierGroupId, assignment]));
  const requestedGroupIds = assignments.map((assignment) => assignment.modifierGroupId);
  await transaction.productModifierGroupAssignment.deleteMany({
    where: {
      productId,
      merchantId,
      ...(requestedGroupIds.length ? { modifierGroupId: { notIn: requestedGroupIds } } : {}),
    },
  });

  for (const item of assignments) {
    const existing = byGroupId.get(item.modifierGroupId);
    const assignment = existing
      ? await transaction.productModifierGroupAssignment.update({
          where: { id: existing.id },
          data: {
            selectionMode: item.selectionMode,
            minSelections: item.minSelections,
            maxSelections: item.maxSelections,
            position: item.position,
          },
          select: { id: true },
        })
      : await transaction.productModifierGroupAssignment.create({
          data: {
            productId,
            modifierGroupId: item.modifierGroupId,
            merchantId,
            selectionMode: item.selectionMode,
            minSelections: item.minSelections,
            maxSelections: item.maxSelections,
            position: item.position,
          },
          select: { id: true },
        });
    if (existing) {
      await transaction.productModifierGroupAssignmentOption.deleteMany({
        where: { assignmentId: assignment.id },
      });
    }
    await transaction.productModifierGroupAssignmentOption.createMany({
      data: item.options.map((option) => ({
        assignmentId: assignment.id,
        modifierGroupId: item.modifierGroupId,
        optionId: option.optionId,
        merchantId,
        maxQuantity: option.maxQuantity ?? 1,
        priceAdjustment: option.priceAdjustment,
        defaultSelected: option.defaultSelected,
      })),
    });
  }
}

export async function assertAssignmentReferences(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  assignments: NonNullable<ProductInput['modifierGroupAssignments']>,
): Promise<void> {
  if (assignments.length === 0) return;
  const ids = [...new Set(assignments.map((assignment) => assignment.modifierGroupId))];
  const groups = await transaction.modifierGroup.findMany({
    where: { merchantId, id: { in: ids } },
    select: { id: true, options: { select: { id: true } } },
  });
  if (groups.length !== ids.length) {
    throw new BadRequestException('Every modifier group must belong to this merchant.');
  }
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const assignment of assignments) {
    const group = byId.get(assignment.modifierGroupId);
    const allowedOptionIds = new Set(group?.options.map((option) => option.id) ?? []);
    const requestedOptionIds = assignment.options.map((option) => option.optionId);
    if (
      !group ||
      new Set(requestedOptionIds).size !== requestedOptionIds.length ||
      requestedOptionIds.length !== allowedOptionIds.size ||
      requestedOptionIds.some((optionId) => !allowedOptionIds.has(optionId))
    ) {
      throw new BadRequestException(
        'Assignment configuration must include every option from the modifier group exactly once.',
      );
    }
    if (
      assignment.options.filter((option) => option.defaultSelected).length >
      assignment.maxSelections
    ) {
      throw new BadRequestException('Default selections cannot exceed the group selection limit.');
    }
  }
}
