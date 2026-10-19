import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  POS_LEGACY_EMPLOYEE_PERMISSIONS,
  POS_EMPLOYEE_PERMISSIONS,
  type PosEmployeePermission,
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
  type CursorPage,
  type PosEmployeeSummary,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { hashPassword } from './password.js';
import {
  createPosEmployeeSchema,
  listPosEmployeesSchema,
  updatePosEmployeeSchema,
  type PosEmployeeListQuery,
} from './pos-employee.schemas.js';

const employeeInclude = {
  branches: {
    orderBy: { branch: { name: 'asc' as const } },
    select: { branch: { select: { id: true, name: true, archivedAt: true } } },
  },
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
        where: { id: query.cursor, merchantId },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const where: Prisma.PosEmployeeWhereInput = {
      merchantId,
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
    if (parsed.branchIds.length === 0)
      throw new ConflictException('Assign at least one active branch.');
    const passwordHash = await hashPassword(parsed.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertActiveBranches(tx, merchantId, parsed.branchIds);
        const employee = await tx.posEmployee.create({
          data: {
            merchantId,
            username: parsed.username,
            displayName: parsed.displayName,
            passwordHash,
            role: parsed.role ?? null,
            permissions:
              !parsed.role || parsed.role === 'cashier' || parsed.role === 'supervisor'
                ? [...POS_LEGACY_EMPLOYEE_PERMISSIONS]
                : [],
            createdBy: actor,
            updatedBy: actor,
            branches: {
              create: parsed.branchIds.map((branchId) => ({
                createdBy: actor,
                branch: { connect: { id_merchantId: { id: branchId, merchantId } } },
              })),
            },
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
    if (parsed.active && parsed.branchIds.length === 0)
      throw new ConflictException('Assign at least one active branch to an active employee.');
    const passwordHash = parsed.password ? await hashPassword(parsed.password) : undefined;
    return this.prisma.$transaction(async (tx) => {
      await this.assertActiveBranches(tx, merchantId, parsed.branchIds);
      const changed = await tx.posEmployee.updateMany({
        where: { id: employeeId, merchantId, revision: parsed.revision },
        data: {
          displayName: parsed.displayName,
          active: parsed.active,
          ...(parsed.role !== undefined ? { role: parsed.role } : {}),
          revision: { increment: 1 },
          updatedBy: actor,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      if (changed.count !== 1) {
        const exists = await tx.posEmployee.findFirst({
          where: { id: employeeId, merchantId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Employee was not found.');
        throw new ConflictException('Employee changed since it was loaded. Refresh and try again.');
      }
      await tx.posEmployeeBranch.deleteMany({ where: { employeeId, merchantId } });
      if (parsed.branchIds.length) {
        await tx.posEmployeeBranch.createMany({
          data: parsed.branchIds.map((branchId) => ({
            employeeId,
            merchantId,
            branchId,
            createdBy: actor,
          })),
        });
      }
      if (passwordHash || !parsed.active) {
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

  private async assertActiveBranches(
    tx: Prisma.TransactionClient,
    merchantId: string,
    branchIds: string[],
  ): Promise<void> {
    if (branchIds.length === 0) return;
    const branches = await tx.branch.findMany({
      where: { id: { in: branchIds }, merchantId, archivedAt: null },
      select: { id: true },
    });
    if (branches.length !== branchIds.length)
      throw new ConflictException(
        'Every assigned branch must be active and belong to this business.',
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
  branches: Array<{ branch: { id: string; name: string; archivedAt: Date | null } }>;
}): PosEmployeeSummary {
  const branches = employee.branches.map(({ branch }) => ({
    id: branch.id,
    name: branch.name,
    archivedAt: branch.archivedAt?.toISOString() ?? null,
  }));
  return {
    id: employee.id,
    username: employee.username,
    displayName: employee.displayName,
    role: isPosEmployeeRole(employee.role) ? employee.role : null,
    savedPermissions: employee.permissions.filter((value): value is PosEmployeePermission =>
      (POS_EMPLOYEE_PERMISSIONS as readonly string[]).includes(value),
    ),
    permissions: resolvePosEmployeePermissions(
      isPosEmployeeRole(employee.role) ? employee.role : null,
      employee.permissions,
    ),
    active: employee.active,
    revision: employee.revision,
    branchIds: branches.map((branch) => branch.id),
    branches,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
