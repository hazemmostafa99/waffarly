/** Shows the current shift and previews its closing result before staff confirm it. */
import { toLiveShiftSummary } from '../shift.mapper.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type {
  PosEmployeeSession,
  PosShiftClosePreview,
  PosShiftClosePreviewRequest,
  PosShiftLiveSummary,
} from '@waffarly/contracts';

import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { toCents } from '../../../common/money/money.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

import { posShiftClosePreviewSchema } from '../shifts.schemas.js';

import { shiftInclude } from '../shift-records.js';
import { buildShiftReconciliation } from './shift-reconciliation.js';
import {
  readCurrentShiftPermissions,
  assertShiftBranchAssignment,
  requireShiftAccess,
} from '../access/shift-access.rules.js';

export async function getReconciliation(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  shiftId: string,
): Promise<PosShiftLiveSummary> {
  requireShiftAccess(employee);
  const shift = await prisma.posShift.findFirst({
    where: {
      id: shiftId,
      merchantId: employee.merchantId,
      status: 'open',
      branch: { archivedAt: null },
      register: { active: true },
    },
    include: shiftInclude,
  });
  if (!shift) throw new NotFoundException('The open register shift was not found.');
  assertShiftBranchAssignment(employee, shift.branchId);
  return toLiveShiftSummary(await buildShiftReconciliation(prisma, shift));
}

export async function previewCloseShift(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  shiftId: string,
  input: unknown,
): Promise<PosShiftClosePreview> {
  requireShiftAccess(employee);
  const request: PosShiftClosePreviewRequest = parseRequest(posShiftClosePreviewSchema, input);
  return prisma.$transaction(
    async (tx) => {
      const shift = await tx.posShift.findFirst({
        where: {
          id: shiftId,
          merchantId: employee.merchantId,
          status: 'open',
          branch: { archivedAt: null },
          register: { active: true },
        },
        include: shiftInclude,
      });
      if (!shift) throw new NotFoundException('The open register shift was not found.');
      assertShiftBranchAssignment(employee, shift.branchId);
      const actorPermissions = await readCurrentShiftPermissions(tx, employee, shift.branchId);
      if (!actorPermissions.includes('open_register_shift'))
        throw new ForbiddenException(
          'This employee is no longer authorized to close register shifts.',
        );
      const reconciliation = await buildShiftReconciliation(tx, shift);
      const variance = toCents(request.countedCash) !== toCents(reconciliation.expectedCash);
      return {
        unsettledCheckCount: reconciliation.unsettledCheckCount,
        requiresReason: reconciliation.unsettledCheckCount === 0 && variance && !request.reason,
        requiresSupervisorApproval:
          (reconciliation.unsettledCheckCount === 0 &&
            variance &&
            !actorPermissions.includes('approve_shift_close')) ||
          Boolean(reconciliation.pendingDeliveryCount),
        ...(reconciliation.pendingDeliveryCount
          ? {
              pendingDeliveryCount: reconciliation.pendingDeliveryCount,
              requiresDeliveryHandover: !request.deliveryHandover,
            }
          : {}),
      };
    },
    { isolationLevel: 'ReadCommitted' },
  );
}
