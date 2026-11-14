/** Attaches or removes reusable choice groups on a product. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { CatalogProductModifierGroupAssignmentFields } from '@waffarly/contracts';

import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../../infrastructure/database/prisma.service.js';
import { createModifierAssignments } from '../persistence/product-modifiers.persistence.js';
import { assertModifierGroupAssignments } from '../persistence/product-references.js';

import {
  replaceModifierDetails,
  assertSavedModifierDetails,
} from '../persistence/modifier-details.persistence.js';
import { productInclude, toProductResponse } from '../product.mapper.js';

import { assertPendingRecipeUnchanged } from '../persistence/pending-recipe.rules.js';

export async function attachModifierGroup(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  productId: string,
  revision: number,
  assignment: CatalogProductModifierGroupAssignmentFields,
) {
  await assertModifierGroupAssignments(prisma, merchantId, [assignment]);
  try {
    const product = await prisma.$transaction(
      async (transaction) => {
        await assertPendingRecipeUnchanged(transaction, merchantId, productId, {
          modifierGroups: [],
        });
        const changed = await transaction.product.updateMany({
          where: { id: productId, merchantId, revision, archivedAt: null },
          data: { revision: { increment: 1 }, updatedBy: actor },
        });
        if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
        await createModifierAssignments(transaction, merchantId, productId, [assignment]);
        await replaceModifierDetails(transaction, merchantId, productId, [assignment]);
        await assertSavedModifierDetails(transaction, merchantId, productId);
        return transaction.product.findUniqueOrThrow({
          where: { id: productId },
          include: productInclude,
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return toProductResponse(product);
  } catch (error) {
    if (isSerializationConflict(error)) {
      throw new ConflictException('Product configuration changed concurrently. Please retry.');
    }
    if (isUniqueConstraintError(error)) {
      throw new ConflictException('This modifier group is already assigned to the product.');
    }
    throw error;
  }
}

export async function detachModifierGroup(
  prisma: PrismaService,
  merchantId: string,
  actor: string,
  productId: string,
  assignmentId: string,
  revision: number,
) {
  try {
    const product = await prisma.$transaction(
      async (transaction) => {
        await assertPendingRecipeUnchanged(transaction, merchantId, productId, {
          modifierGroups: [],
        });
        const changed = await transaction.product.updateMany({
          where: { id: productId, merchantId, revision, archivedAt: null },
          data: { revision: { increment: 1 }, updatedBy: actor },
        });
        if (changed.count !== 1) throw new ConflictException('Product is missing or stale.');
        const detached = await transaction.productModifierGroupAssignment.deleteMany({
          where: { id: assignmentId, productId, merchantId },
        });
        if (detached.count !== 1) {
          throw new NotFoundException('Modifier group assignment was not found.');
        }
        return transaction.product.findUniqueOrThrow({
          where: { id: productId },
          include: productInclude,
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return toProductResponse(product);
  } catch (error) {
    if (isSerializationConflict(error)) {
      throw new ConflictException('Product configuration changed concurrently. Please retry.');
    }
    throw error;
  }
}
