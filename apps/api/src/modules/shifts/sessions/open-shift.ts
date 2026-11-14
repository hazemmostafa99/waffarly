/** Opens a cashier shift with its counted starting cash and any accepted carryover. */
import { toMatchingRetry, toShiftSummary } from '../shift.mapper.js';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { PosEmployeeSession, PosShiftSummary } from '@waffarly/contracts';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';

import { isUniqueConstraintError } from '../../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { openPosShiftSchema } from '../shifts.schemas.js';
import { normalizeOpeningFloat } from '../shifts.rules.js';
import { carryClosedCash } from '../cash-custody.persistence.js';
import { shiftInclude } from '../shift-records.js';
import {
  readCurrentShiftPermissions,
  assertShiftBranchAssignment,
  requireShiftAccess,
} from '../access/shift-access.rules.js';

export async function openShift(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  input: unknown,
): Promise<PosShiftSummary> {
  requireShiftAccess(employee);
  // 1. Check the opening details and the employee access.
  const parsed = parseRequest(openPosShiftSchema, input);
  const openingFloat = normalizeOpeningFloat(parsed.openingFloat);

  try {
    // 2. Save the opening cash and any carryover with the shift.
    return await prisma.$transaction(async (tx) => {
      const prior = await tx.posShift.findFirst({
        where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
        include: shiftInclude,
      });
      if (prior)
        return toMatchingRetry(
          prior,
          employee,
          parsed.registerId,
          openingFloat,
          parsed.sourceShiftId,
        );

      const locked = await tx.$queryRaw<Array<{ id: string; branchId: string; active: boolean }>>`
          SELECT "id", "branchId", "active"
          FROM "pos_registers"
          WHERE "id" = ${parsed.registerId} AND "merchantId" = ${employee.merchantId}
          FOR UPDATE
        `;
      const register = locked[0];
      if (!register || !register.active) throw new NotFoundException('Register was not found.');
      assertShiftBranchAssignment(employee, register.branchId);

      if (parsed.sourceShiftId) {
        const permissions = await readCurrentShiftPermissions(tx, employee, register.branchId);
        if (!permissions.includes('open_register_shift'))
          throw new ForbiddenException('Shift opening is no longer permitted.');
      }

      // Another identical request may have committed while this transaction waited on the register lock.
      const committedRetry = await tx.posShift.findFirst({
        where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
        include: shiftInclude,
      });
      if (committedRetry) {
        return toMatchingRetry(
          committedRetry,
          employee,
          parsed.registerId,
          openingFloat,
          parsed.sourceShiftId,
        );
      }

      const current = await tx.posShift.findFirst({
        where: {
          merchantId: employee.merchantId,
          registerId: register.id,
          status: { in: ['open', 'closing'] },
        },
        select: { id: true },
      });
      if (current) throw new ConflictException('A shift is already open on this register.');

      const record = await tx.posShift.create({
        data: {
          merchantId: employee.merchantId,
          branchId: register.branchId,
          registerId: register.id,
          openRequestId: parsed.requestId,
          openedByEmployeeId: employee.id,
          openingFloat,
          currency: 'EGP',
          status: 'open',
        },
        include: shiftInclude,
      });
      if (parsed.sourceShiftId) {
        await carryClosedCash(tx, {
          merchantId: employee.merchantId,
          branchId: register.branchId,
          registerId: register.id,
          sourceShiftId: parsed.sourceShiftId,
          destinationShiftId: record.id,
          requestId: parsed.requestId,
          amount: openingFloat,
          actor: `pos:${employee.id}`,
        });
      }
      return toShiftSummary(record);
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const prior = await prisma.posShift.findFirst({
      where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
      include: shiftInclude,
    });
    if (prior)
      return toMatchingRetry(
        prior,
        employee,
        parsed.registerId,
        openingFloat,
        parsed.sourceShiftId,
      );
    throw new ConflictException('A shift is already open on this register.');
  }
}
