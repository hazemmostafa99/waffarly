/** Checks which branch an employee may use for cash handoff and receipt. */
import { ForbiddenException } from '@nestjs/common';

import {
  type PosEmployeeSession,
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
} from '@waffarly/contracts';

import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';

export async function requireEmployeeCashBranch(
  prisma: PrismaService,
  employee: PosEmployeeSession,
  branchId: string,
  manage = false,
  db: PrismaService | Prisma.TransactionClient = prisma,
): Promise<void> {
  if (!employee.branches.some((branch) => branch.id === branchId && branch.archivedAt === null))
    throw new ForbiddenException('Branch is not assigned.');
  const record = await db.posEmployee.findFirst({
    where: {
      id: employee.id,
      merchantId: employee.merchantId,
      active: true,
      branches: { some: { branchId, branch: { archivedAt: null } } },
    },
  });
  const permissions = record
    ? resolvePosEmployeePermissions(
        isPosEmployeeRole(record.role) ? record.role : null,
        record.permissions,
      )
    : [];
  if (!permissions.includes(manage ? 'manage_cash_movements' : 'open_register_shift'))
    throw new ForbiddenException('Cash access is not permitted.');
}
