/** Manages a restaurant's courier list, POS assignments, and operating performance report. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CursorPage,
  DeliveryCourierOption,
  DeliveryCourierPerformance,
  DeliveryCourierPerformanceReport,
  DeliveryCourierSummary,
  PosEmployeeSession,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../../common/http/pagination.js';
import { parseRequest } from '../../../common/http/zod-validation.pipe.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { assertDeliveryBranchAccess } from './delivery-access.rules.js';
import {
  createDeliveryCourierSchema,
  listDeliveryCouriersSchema,
  listPosDeliveryCouriersSchema,
  updateDeliveryCourierSchema,
} from './delivery-courier.schemas.js';

const courierInclude = {
  branches: { include: { branch: { select: { id: true, name: true, archivedAt: true } } } },
} satisfies Prisma.DeliveryCourierInclude;

type DeliveryCourierRecord = Prisma.DeliveryCourierGetPayload<{ include: typeof courierInclude }>;

@Injectable()
export class DeliveryCourierService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async listForOwner(
    merchantId: string,
    input: unknown,
  ): Promise<CursorPage<DeliveryCourierSummary>> {
    const query = parseRequest(listDeliveryCouriersSchema, input);
    const where: Prisma.DeliveryCourierWhereInput = {
      merchantId,
      ...(query.status === 'active'
        ? { active: true }
        : query.status === 'inactive'
          ? { active: false }
          : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (query.cursor) {
      const anchor = await this.db.deliveryCourier.findFirst({
        where: { id: query.cursor, merchantId },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }

    const records = await this.db.deliveryCourier.findMany({
      where,
      include: courierInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = records.slice(0, query.limit).map(toDeliveryCourierSummary);
    return {
      items,
      nextCursor: records.length > query.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async listForPos(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<CursorPage<DeliveryCourierOption>> {
    const query = parseRequest(listPosDeliveryCouriersSchema, input);
    const branchId = employee.branch.id;
    assertDeliveryBranchAccess(employee, branchId);

    const where: Prisma.DeliveryCourierWhereInput = {
      merchantId: employee.merchantId,
      active: true,
      branches: {
        some: { branchId, branch: { archivedAt: null } },
      },
    };
    if (query.cursor) {
      const anchor = await this.db.deliveryCourier.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const records = await this.db.deliveryCourier.findMany({
      where,
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = records.slice(0, query.limit);
    return {
      items,
      nextCursor: records.length > query.limit ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async performanceForOwner(merchantId: string): Promise<DeliveryCourierPerformanceReport> {
    const generatedAt = new Date();
    const periodStart = new Date(generatedAt.getTime() - 30 * 24 * 60 * 60 * 1000);
    const items = await this.db.$queryRaw<DeliveryCourierPerformance[]>`
      SELECT
        c."id" AS "courierId",
        c."name" AS "courierName",
        c."active",
        COUNT(a."id")::int AS "attemptCount",
        COUNT(a."id") FILTER (WHERE a."status" = 'delivered')::int AS "deliveredCount",
        COUNT(a."id") FILTER (WHERE a."status" = 'failed')::int AS "failedCount",
        COUNT(a."id") FILTER (WHERE a."status" = 'out_for_delivery')::int AS "activeAttemptCount",
        CASE
          WHEN COUNT(a."id") FILTER (WHERE a."status" IN ('delivered', 'failed')) = 0 THEN NULL
          ELSE ROUND(
            COUNT(a."id") FILTER (WHERE a."status" = 'delivered') * 100.0 /
            COUNT(a."id") FILTER (WHERE a."status" IN ('delivered', 'failed')),
            1
          )::float8
        END AS "successRate",
        ROUND(
          (AVG(EXTRACT(EPOCH FROM (a."completedAt" - a."dispatchedAt")) / 60.0)
            FILTER (WHERE a."status" = 'delivered' AND a."completedAt" IS NOT NULL))::numeric,
          1
        )::float8 AS "averageDeliveryMinutes"
      FROM "delivery_couriers" c
      LEFT JOIN "delivery_courier_attempts" a
        ON a."courierId" = c."id"
        AND a."merchantId" = c."merchantId"
        AND a."dispatchedAt" >= ${periodStart}
      WHERE c."merchantId" = ${merchantId}::uuid
      GROUP BY c."id", c."name", c."active"
      ORDER BY c."name" ASC, c."id" ASC
    `;
    return {
      periodStart: periodStart.toISOString(),
      generatedAt: generatedAt.toISOString(),
      items,
    };
  }

  async create(merchantId: string, actor: string, input: unknown): Promise<DeliveryCourierSummary> {
    const parsed = parseRequest(createDeliveryCourierSchema, input);
    return this.db.$transaction(async (tx) => {
      await assertCourierBranches(tx, merchantId, parsed.branchIds, true);
      const courier = await tx.deliveryCourier.create({
        data: {
          merchantId,
          name: parsed.name,
          phone: parsed.phone,
          createdBy: actor,
          updatedBy: actor,
        },
      });
      await tx.deliveryCourierBranch.createMany({
        data: parsed.branchIds.map((branchId) => ({
          merchantId,
          courierId: courier.id,
          branchId,
        })),
      });
      const saved = await tx.deliveryCourier.findFirstOrThrow({
        where: { id: courier.id, merchantId },
        include: courierInclude,
      });
      return toDeliveryCourierSummary(saved);
    });
  }

  async update(
    merchantId: string,
    actor: string,
    courierId: string,
    input: unknown,
  ): Promise<DeliveryCourierSummary> {
    const parsed = parseRequest(updateDeliveryCourierSchema, input);
    return this.db.$transaction(async (tx) => {
      const current = await tx.deliveryCourier.findFirst({
        where: { id: courierId, merchantId },
        select: { revision: true },
      });
      if (!current) throw new NotFoundException('Courier was not found.');
      if (current.revision !== parsed.revision)
        throw new ConflictException('Courier changed since it was loaded. Refresh and try again.');

      await assertCourierBranches(tx, merchantId, parsed.branchIds, parsed.active);
      const changed = await tx.deliveryCourier.updateMany({
        where: { id: courierId, merchantId, revision: parsed.revision },
        data: {
          name: parsed.name,
          phone: parsed.phone,
          active: parsed.active,
          revision: { increment: 1 },
          updatedBy: actor,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Courier changed since it was loaded. Refresh and try again.');

      await tx.deliveryCourierBranch.deleteMany({ where: { courierId, merchantId } });
      await tx.deliveryCourierBranch.createMany({
        data: parsed.branchIds.map((branchId) => ({ merchantId, courierId, branchId })),
      });
      const saved = await tx.deliveryCourier.findFirst({
        where: { id: courierId, merchantId },
        include: courierInclude,
      });
      if (!saved) throw new NotFoundException('Courier was not found.');
      return toDeliveryCourierSummary(saved);
    });
  }
}

async function assertCourierBranches(
  tx: Prisma.TransactionClient,
  merchantId: string,
  branchIds: string[],
  requireActiveBranch: boolean,
): Promise<void> {
  // 1. Keep selected branch state stable until the courier and assignments commit.
  for (const branchId of [...branchIds].sort())
    await tx.$queryRaw`SELECT "id" FROM "branches" WHERE "id" = ${branchId}::uuid AND "merchantId" = ${merchantId}::uuid FOR SHARE`;

  const branches = await tx.branch.findMany({
    where: { merchantId, id: { in: branchIds } },
    select: { id: true, archivedAt: true },
  });
  if (branches.length !== branchIds.length)
    throw new ConflictException('Select branches that belong to this business.');
  if (requireActiveBranch && branches.every((branch) => branch.archivedAt !== null))
    throw new ConflictException('An active courier must be assigned to an active branch.');
}

function toDeliveryCourierSummary(courier: DeliveryCourierRecord): DeliveryCourierSummary {
  return {
    id: courier.id,
    name: courier.name,
    phone: courier.phone,
    active: courier.active,
    revision: courier.revision,
    branches: courier.branches
      .map(({ branch }) => ({
        id: branch.id,
        name: branch.name,
        archivedAt: branch.archivedAt?.toISOString() ?? null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    createdAt: courier.createdAt.toISOString(),
    updatedAt: courier.updatedAt.toISOString(),
  };
}
