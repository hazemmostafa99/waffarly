/** Manages staff accounts, their roles, permissions and single-branch assignment for one merchant. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  defaultPosEmployeePermissions,
  isPosEmployeeRole,
  normalizePosEmployeePermissions,
  resolvePosEmployeePermissions,
  type CursorPage,
  type PosEmployeeSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { hashPassword } from '../auth/index.js';
import {
  createPosEmployeeSchema,
  listPosEmployeesSchema,
  updatePosEmployeeSchema,
  type PosEmployeeListQuery,
} from './pos-employee.schemas.js';

const employeeInclude = {
  branch: { select: { id: true, name: true, archivedAt: true } },
} satisfies Prisma.PosEmployeeInclude;

@Injectable()
export class PosEmployeeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    merchantId: string,
    input: PosEmployeeListQuery,
  ): Promise<CursorPage<PosEmployeeSummary>> {
    const query = parseRequest(listPosEmployeesSchema, input);
    if (query.cursor) {
      const anchor = await this.prisma.posEmployee.findFirst({
        where: { id: query.cursor, merchantId, ownerAccountId: null },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const where: Prisma.PosEmployeeWhereInput = {
      merchantId,
      ownerAccountId: null,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status === 'active'
        ? { active: true }
        : query.status === 'inactive'
          ? { active: false }
          : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const records = await this.prisma.posEmployee.findMany({
      where,
      include: employeeInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit).map(toEmployeeSummary);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async create(merchantId: string, actor: string, input: unknown): Promise<PosEmployeeSummary> {
    const parsed = parseRequest(createPosEmployeeSchema, input);
    const passwordHash = await hashPassword(parsed.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertActiveBranch(tx, merchantId, parsed.branchId);
        const employee = await tx.posEmployee.create({
          data: {
            merchantId,
            branchId: parsed.branchId,
            username: parsed.username,
            displayName: parsed.displayName,
            passwordHash,
            role: parsed.role ?? null,
            permissions: parsed.permissions
              ? normalizePosEmployeePermissions(parsed.permissions)
              : defaultPosEmployeePermissions(parsed.role ?? null),
            createdBy: actor,
            updatedBy: actor,
          },
          include: employeeInclude,
        });
        return toEmployeeSummary(employee);
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException('That username is already in use.');
      throw error;
    }
  }

  async update(
    merchantId: string,
    actor: string,
    employeeId: string,
    input: unknown,
  ): Promise<PosEmployeeSummary> {
    const parsed = parseRequest(updatePosEmployeeSchema, input);
    const passwordHash = parsed.password ? await hashPassword(parsed.password) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.posEmployee.findFirst({
        where: { id: employeeId, merchantId, ownerAccountId: null },
        select: { branchId: true, revision: true, role: true },
      });
      if (!current) throw new NotFoundException('Employee was not found.');
      if (current.revision !== parsed.revision) {
        throw new ConflictException('Employee changed since it was loaded. Refresh and try again.');
      }
      // Without an explicit list, a role change starts from the new role's defaults
      // so moving a cashier to accounting does not keep sales access.
      const permissions = parsed.permissions
        ? normalizePosEmployeePermissions(parsed.permissions)
        : parsed.role !== undefined && parsed.role !== current.role
          ? defaultPosEmployeePermissions(parsed.role)
          : undefined;

      await this.assertActiveBranch(tx, merchantId, parsed.branchId);
      const changed = await tx.posEmployee.updateMany({
        where: { id: employeeId, merchantId, revision: parsed.revision },
        data: {
          branchId: parsed.branchId,
          displayName: parsed.displayName,
          active: parsed.active,
          ...(parsed.role !== undefined ? { role: parsed.role } : {}),
          ...(permissions ? { permissions } : {}),
          revision: { increment: 1 },
          updatedBy: actor,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('Employee changed since it was loaded. Refresh and try again.');
      }
      if (passwordHash || !parsed.active || current.branchId !== parsed.branchId) {
        await tx.authSession.deleteMany({ where: { subjectKind: 'POS', subjectId: employeeId } });
      }
      const employee = await tx.posEmployee.findFirst({
        where: { id: employeeId, merchantId },
        include: employeeInclude,
      });
      if (!employee) throw new NotFoundException('Employee was not found.');
      return toEmployeeSummary(employee);
    });
  }

  private async assertActiveBranch(
    tx: Prisma.TransactionClient,
    merchantId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await tx.branch.findFirst({
      where: { id: branchId, merchantId, archivedAt: null },
      select: { id: true },
    });
    if (!branch)
      throw new ConflictException(
        'Select an active branch that belongs to this business.',
      );
  }
}

function toEmployeeSummary(employee: {
  id: string;
  username: string;
  displayName: string;
  role: string | null;
  permissions: string[];
  active: boolean;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  branch: { id: string; name: string; archivedAt: Date | null };
}): PosEmployeeSummary {
  const assignedBranch = employee.branch;
  const branch = {
    id: assignedBranch.id,
    name: assignedBranch.name,
    archivedAt: assignedBranch.archivedAt?.toISOString() ?? null,
  };
  const role = isPosEmployeeRole(employee.role) ? employee.role : null;
  const permissions = resolvePosEmployeePermissions(role, employee.permissions);
  return {
    id: employee.id,
    username: employee.username,
    displayName: employee.displayName,
    role,
    savedPermissions: permissions,
    permissions,
    active: employee.active,
    revision: employee.revision,
    branch,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
