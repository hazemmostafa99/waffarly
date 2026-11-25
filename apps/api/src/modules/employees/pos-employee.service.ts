/** Manages staff accounts, their roles and single-branch assignment for one merchant. */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  POS_LEGACY_EMPLOYEE_PERMISSIONS,
  POS_EMPLOYEE_PERMISSIONS,
  type ActivityFeatureSettings,
  type PosEmployeePermission,
  type PosEmployeeRole,
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
import { hashPassword } from '../auth/index.js';
import {
  createPosEmployeeSchema,
  listPosEmployeesSchema,
  updatePosEmployeeSchema,
  type PosEmployeeListQuery,
} from './pos-employee.schemas.js';

/** The Kitchen role only exists for merchants whose activity has the kitchen feature on. */
function requireRoleAvailable(
  role: PosEmployeeRole | null | undefined,
  features: ActivityFeatureSettings,
): void {
  if (role === 'kitchen' && !features.kitchen)
    throw new BadRequestException('The kitchen role is not available for this business activity.');
}

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

  /** `features` comes from the owner session; HTTP callers always pass it so roles follow the activity. */
  async create(
    merchantId: string,
    actor: string,
    input: unknown,
    features?: ActivityFeatureSettings,
  ): Promise<PosEmployeeSummary> {
    const parsed = parseRequest(createPosEmployeeSchema, input);
    if (features) requireRoleAvailable(parsed.role, features);
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
            permissions:
              !parsed.role || parsed.role === 'cashier' || parsed.role === 'supervisor'
                ? [...POS_LEGACY_EMPLOYEE_PERMISSIONS]
                : [],
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
    features?: ActivityFeatureSettings,
  ): Promise<PosEmployeeSummary> {
    const parsed = parseRequest(updatePosEmployeeSchema, input);
    if (features) requireRoleAvailable(parsed.role, features);
    const passwordHash = parsed.password ? await hashPassword(parsed.password) : undefined;
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.posEmployee.findFirst({
        where: { id: employeeId, merchantId },
        select: { branchId: true, revision: true },
      });
      if (!current) throw new NotFoundException('Employee was not found.');
      if (current.revision !== parsed.revision) {
        throw new ConflictException('Employee changed since it was loaded. Refresh and try again.');
      }

      await this.assertActiveBranch(tx, merchantId, parsed.branchId);
      const changed = await tx.posEmployee.updateMany({
        where: { id: employeeId, merchantId, revision: parsed.revision },
        data: {
          branchId: parsed.branchId,
          displayName: parsed.displayName,
          active: parsed.active,
          ...(parsed.role !== undefined ? { role: parsed.role } : {}),
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
    branch,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
