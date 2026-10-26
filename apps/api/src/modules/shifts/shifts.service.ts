import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readDeliveryBalances } from './delivery-reconciliation.js';
import type { PosDeliveryHandoverSnapshot } from '@waffarly/contracts';
import type {
  CursorPage,
  PosEmployeeSession,
  PosRegisterOption,
  PosRegisterSummary,
  PosShiftCloseReport as PosShiftCloseReportContract,
  PosShiftCloseReportRow,
  PosShiftClosePreview,
  PosShiftClosePreviewRequest,
  PosShiftLiveSummary,
  PosShiftManualCashMovementSummary,
  PosShiftReconciliationSummary,
  PosShiftSummary,
  RecordPosShiftCashMovementResponse,
} from '@waffarly/contracts';
import type { Prisma, PrismaClient } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { formatCents, toCents, toSignedCents } from '../../common/money/money.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { isPosEmployeeRole, resolvePosEmployeePermissions } from '@waffarly/contracts';
import {
  closePosShiftSchema,
  createPosRegisterSchema,
  openPosShiftSchema,
  ownerPosRegisterListSchema,
  ownerPosShiftCloseReportsSchema,
  posCurrentShiftSchema,
  posRegisterListSchema,
  posShiftClosePreviewSchema,
  recordPosShiftCashMovementSchema,
  updatePosRegisterSchema,
  withoutShiftCashMovementApproval,
  withoutShiftCloseApproval,
  type OwnerPosRegisterListQuery,
  type OwnerPosShiftCloseReportsInput,
} from './shifts.schemas.js';
import { normalizeOpeningFloat } from './shifts.rules.js';

const registerInclude = {
  branch: { select: { id: true, name: true } },
} satisfies Prisma.PosRegisterInclude;

const shiftInclude = {
  register: { select: { name: true } },
  openedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.PosShiftInclude;

type RegisterRecord = Prisma.PosRegisterGetPayload<{ include: typeof registerInclude }>;
type ShiftRecord = Prisma.PosShiftGetPayload<{ include: typeof shiftInclude }>;

const manualCashMovementInclude = {
  operator: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
} satisfies Prisma.PosShiftManualCashMovementInclude;

const closeReportInclude = {
  operator: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  shift: { select: { branchId: true } },
} satisfies Prisma.PosShiftCloseReportInclude;

type ManualCashMovementRecord = Prisma.PosShiftManualCashMovementGetPayload<{
  include: typeof manualCashMovementInclude;
}>;
type CloseReportRecord = Prisma.PosShiftCloseReportGetPayload<{
  include: typeof closeReportInclude;
}>;

const ownerCloseReportSelect = {
  deliveryCashReceived: true,
  deliveryHandover: true,
  id: true,
  shiftId: true,
  currency: true,
  openingFloat: true,
  cashSales: true,
  cashRefunds: true,
  cashIn: true,
  cashOut: true,
  cashDrop: true,
  expectedCash: true,
  countedCash: true,
  variance: true,
  terminalSales: true,
  terminalRefunds: true,
  reason: true,
  closedAt: true,
  operator: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  shift: {
    select: {
      branchId: true,
      openedAt: true,
      register: { select: { name: true } },
      branch: { select: { name: true } },
      openedBy: { select: { displayName: true } },
    },
  },
} satisfies Prisma.PosShiftCloseReportSelect;

type OwnerCloseReportRecord = Prisma.PosShiftCloseReportGetPayload<{
  select: typeof ownerCloseReportSelect;
}>;

@Injectable()
export class ShiftsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listOwnerRegisters(
    merchantId: string,
    input: OwnerPosRegisterListQuery,
  ): Promise<CursorPage<PosRegisterSummary>> {
    const query = parseRequest(ownerPosRegisterListSchema, input);
    if (query.cursor) {
      const anchor = await this.prisma.posRegister.findFirst({
        where: {
          id: query.cursor,
          merchantId,
          ...(query.branchId ? { branchId: query.branchId } : {}),
          ...(query.status === 'active'
            ? { active: true }
            : query.status === 'inactive'
              ? { active: false }
              : {}),
        },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }

    const records = await this.prisma.posRegister.findMany({
      where: {
        merchantId,
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.status === 'active'
          ? { active: true }
          : query.status === 'inactive'
            ? { active: false }
            : {}),
      },
      include: registerInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit).map(toRegisterSummary);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async listOwnerCloseReports(
    merchantId: string,
    input: OwnerPosShiftCloseReportsInput,
  ): Promise<CursorPage<PosShiftCloseReportRow>> {
    const query = parseRequest(ownerPosShiftCloseReportsSchema, input);
    const branch = query.branchId
      ? await this.prisma.branch.findFirst({
          where: { id: query.branchId, merchantId, archivedAt: null },
          select: { id: true },
        })
      : null;
    if (query.branchId && !branch) throw new NotFoundException('Branch not found.');

    const from = new Date(query.from);
    const to = new Date(query.to);
    const where: Prisma.PosShiftCloseReportWhereInput = {
      merchantId,
      closedAt: { gte: from, lt: to },
      ...(branch ? { shift: { is: { branchId: branch.id } } } : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.posShiftCloseReport.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }

    const records = await this.prisma.posShiftCloseReport.findMany({
      where,
      select: ownerCloseReportSelect,
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit).map(toOwnerCloseReportRow);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async createRegister(
    merchantId: string,
    actor: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    const parsed = parseRequest(createPosRegisterSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findFirst({
          where: { id: parsed.branchId, merchantId, archivedAt: null },
          select: { id: true },
        });
        if (!branch) throw new ConflictException('Select an active branch for this register.');
        const record = await tx.posRegister.create({
          data: {
            merchantId,
            branchId: branch.id,
            name: parsed.name,
            createdBy: actor,
            updatedBy: actor,
          },
          include: registerInclude,
        });
        return toRegisterSummary(record);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A register with this name already exists at the branch.');
      }
      throw error;
    }
  }

  async updateRegister(
    merchantId: string,
    actor: string,
    registerId: string,
    input: unknown,
  ): Promise<PosRegisterSummary> {
    const parsed = parseRequest(updatePosRegisterSchema, input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "pos_registers"
          WHERE "id" = ${registerId} AND "merchantId" = ${merchantId}
          FOR UPDATE
        `;
        if (locked.length === 0) throw new NotFoundException('Register was not found.');

        const current = await tx.posRegister.findFirst({
          where: { id: registerId, merchantId },
          select: { id: true, active: true, revision: true },
        });
        if (!current) throw new NotFoundException('Register was not found.');
        if (current.revision !== parsed.revision) {
          throw new ConflictException(
            'Register changed since it was loaded. Refresh and try again.',
          );
        }
        if (current.active && !parsed.active) {
          const openShift = await tx.posShift.findFirst({
            where: { merchantId, registerId, status: { in: ['open', 'closing'] } },
            select: { id: true },
          });
          if (openShift)
            throw new ConflictException('Close the active shift before disabling this register.');
        }

        const changed = await tx.posRegister.updateMany({
          where: { id: registerId, merchantId, revision: parsed.revision },
          data: {
            name: parsed.name,
            active: parsed.active,
            revision: { increment: 1 },
            updatedBy: actor,
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException(
            'Register changed since it was loaded. Refresh and try again.',
          );
        }
        const updated = await tx.posRegister.findFirst({
          where: { id: registerId, merchantId },
          include: registerInclude,
        });
        if (!updated) throw new NotFoundException('Register was not found.');
        return toRegisterSummary(updated);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A register with this name already exists at the branch.');
      }
      throw error;
    }
  }

  async listForEmployee(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<PosRegisterOption[]> {
    this.requireShiftCapability(employee);
    const query = parseRequest(posRegisterListSchema, input);
    this.assertAssignedBranch(employee, query.branchId);
    const records = await this.prisma.posRegister.findMany({
      where: {
        merchantId: employee.merchantId,
        branchId: query.branchId,
        active: true,
        branch: { archivedAt: null },
      },
      select: { id: true, branchId: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return records;
  }

  async getCurrentShift(
    employee: PosEmployeeSession,
    registerId: string,
  ): Promise<PosShiftSummary | null> {
    this.requireShiftCapability(employee);
    const query = parseRequest(posCurrentShiftSchema, { registerId });
    const register = await this.prisma.posRegister.findFirst({
      where: { id: query.registerId, merchantId: employee.merchantId },
      select: { id: true, branchId: true, active: true },
    });
    if (!register || !register.active) throw new NotFoundException('Register was not found.');
    this.assertAssignedBranch(employee, register.branchId);
    const current = await this.prisma.posShift.findFirst({
      where: { merchantId: employee.merchantId, registerId, status: 'open' },
      include: shiftInclude,
    });
    return current ? toShiftSummary(current) : null;
  }

  async getReconciliation(
    employee: PosEmployeeSession,
    shiftId: string,
  ): Promise<PosShiftLiveSummary> {
    this.requireShiftCapability(employee);
    const shift = await this.prisma.posShift.findFirst({
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
    this.assertAssignedBranch(employee, shift.branchId);
    return toLiveShiftSummary(await buildShiftReconciliation(this.prisma, shift));
  }

  async previewCloseShift(
    employee: PosEmployeeSession,
    shiftId: string,
    input: unknown,
  ): Promise<PosShiftClosePreview> {
    this.requireShiftCapability(employee);
    const request: PosShiftClosePreviewRequest = parseRequest(posShiftClosePreviewSchema, input);
    return this.prisma.$transaction(
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
        this.assertAssignedBranch(employee, shift.branchId);
        const actorPermissions = await this.currentEmployeePermissions(
          tx,
          employee,
          shift.branchId,
        );
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

  async getShiftBranch(employee: PosEmployeeSession, shiftId: string): Promise<string> {
    this.requireShiftCapability(employee);
    const shift = await this.prisma.posShift.findFirst({
      where: { id: shiftId, merchantId: employee.merchantId },
      select: { branchId: true },
    });
    if (!shift) throw new NotFoundException('The register shift was not found.');
    this.assertAssignedBranch(employee, shift.branchId);
    return shift.branchId;
  }

  async getLatestCloseReport(
    employee: PosEmployeeSession,
    registerId: string,
  ): Promise<PosShiftCloseReportContract | null> {
    this.requireShiftCapability(employee);
    const query = parseRequest(posCurrentShiftSchema, { registerId });
    const report = await this.prisma.posShiftCloseReport.findFirst({
      where: {
        merchantId: employee.merchantId,
        shift: {
          registerId: query.registerId,
          status: 'closed',
          branchId: {
            in: employee.branches
              .filter((branch) => branch.archivedAt === null)
              .map((branch) => branch.id),
          },
          register: { merchantId: employee.merchantId },
        },
      },
      include: closeReportInclude,
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
    });
    return report ? toCloseReport(report) : null;
  }

  async getCloseReport(
    employee: PosEmployeeSession,
    shiftId: string,
  ): Promise<PosShiftCloseReportContract> {
    this.requireShiftCapability(employee);
    const report = await this.prisma.posShiftCloseReport.findFirst({
      where: {
        shiftId,
        merchantId: employee.merchantId,
        shift: {
          branchId: {
            in: employee.branches
              .filter((branch) => branch.archivedAt === null)
              .map((branch) => branch.id),
          },
        },
      },
      include: closeReportInclude,
    });
    if (!report) throw new NotFoundException('The shift close report was not found.');
    return toCloseReport(report);
  }

  async recordManualCashMovement(
    employee: PosEmployeeSession,
    shiftId: string,
    input: unknown,
    approverEmployeeId?: string,
  ): Promise<RecordPosShiftCashMovementResponse> {
    this.requireShiftCapability(employee);
    const parsed = parseRequest(recordPosShiftCashMovementSchema, input);
    const request = withoutShiftCashMovementApproval(parsed);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({ shiftId, ...request, approverEmployeeId: approverEmployeeId ?? null }),
      )
      .digest('hex');
    const existing = await this.prisma.posShiftManualCashMovement.findFirst({
      where: { merchantId: employee.merchantId, requestId: request.requestId },
      include: manualCashMovementInclude,
    });
    if (existing) return this.replayManualCashMovement(employee, existing, shiftId, fingerprint);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const prior = await tx.posShiftManualCashMovement.findFirst({
            where: { merchantId: employee.merchantId, requestId: request.requestId },
            include: manualCashMovementInclude,
          });
          if (prior)
            return this.replayManualCashMovement(employee, prior, shiftId, fingerprint, tx);

          const shiftRow = await lockOpenShiftForCashMovement(tx, employee, shiftId);
          this.assertAssignedBranch(employee, shiftRow.branchId);
          const actorPermissions = await this.currentEmployeePermissions(
            tx,
            employee,
            shiftRow.branchId,
          );
          if (!actorPermissions.includes('sell'))
            throw new ForbiddenException(
              'This employee is not authorized to change register cash.',
            );
          let approverEmployeeIdForRecord: string | null = null;
          if (actorPermissions.includes('manage_cash_movements')) {
            if (approverEmployeeId) {
              approverEmployeeIdForRecord = await this.requireCurrentApprover(
                tx,
                employee,
                shiftRow.branchId,
                approverEmployeeId,
                'manage_cash_movements',
              );
            }
          } else {
            if (!approverEmployeeId)
              throw new ForbiddenException('Supervisor approval is required for a cash movement.');
            approverEmployeeIdForRecord = await this.requireCurrentApprover(
              tx,
              employee,
              shiftRow.branchId,
              approverEmployeeId,
              'manage_cash_movements',
            );
          }
          const movement = await tx.posShiftManualCashMovement.create({
            data: {
              merchantId: employee.merchantId,
              shiftId,
              requestId: request.requestId,
              fingerprint,
              kind: request.kind,
              amount: request.amount,
              dropReference: request.dropReference ?? null,
              reason: request.reason,
              operatorEmployeeId: employee.id,
              approvedByEmployeeId: approverEmployeeIdForRecord,
            },
            include: manualCashMovementInclude,
          });
          const shift = await tx.posShift.findFirstOrThrow({
            where: { id: shiftId, merchantId: employee.merchantId, status: 'open' },
            include: shiftInclude,
          });
          return {
            shiftId,
            reconciliation: toLiveShiftSummary(await buildShiftReconciliation(tx, shift)),
            movement: toManualCashMovementSummary(movement),
          };
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
        const prior = await this.prisma.posShiftManualCashMovement.findFirst({
          where: { merchantId: employee.merchantId, requestId: request.requestId },
          include: manualCashMovementInclude,
        });
        if (prior) return this.replayManualCashMovement(employee, prior, shiftId, fingerprint);
        throw new ConflictException(
          'The cash movement changed concurrently. Refresh the shift and retry.',
        );
      }
      throw error;
    }
  }

  async closeShift(
    employee: PosEmployeeSession,
    shiftId: string,
    input: unknown,
    approverEmployeeId?: string,
  ): Promise<PosShiftCloseReportContract> {
    this.requireShiftCapability(employee);
    const parsed = parseRequest(closePosShiftSchema, input);
    const request = withoutShiftCloseApproval(parsed);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({ shiftId, ...request, approverEmployeeId: approverEmployeeId ?? null }),
      )
      .digest('hex');
    const previous = await this.prisma.posShiftCloseReport.findFirst({
      where: { merchantId: employee.merchantId, requestId: request.requestId },
      include: closeReportInclude,
    });
    if (previous) return this.replayShiftClose(employee, previous, shiftId, fingerprint);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const prior = await tx.posShiftCloseReport.findFirst({
            where: { merchantId: employee.merchantId, requestId: request.requestId },
            include: closeReportInclude,
          });
          if (prior) return this.replayShiftClose(employee, prior, shiftId, fingerprint, tx);

          const locked = await tx.$queryRaw<Array<{ id: string; branchId: string }>>`
            SELECT s."id", s."branchId"
            FROM "pos_shifts" s
            INNER JOIN "pos_registers" r
              ON r."id" = s."registerId" AND r."branchId" = s."branchId"
                AND r."merchantId" = s."merchantId" AND r."active" = true
            WHERE s."id" = ${shiftId}::uuid
              AND s."merchantId" = ${employee.merchantId}::uuid
              AND s."status" = 'open'
            FOR UPDATE OF s`;
          const lockedShift = locked[0];
          if (!lockedShift)
            throw new ConflictException('This register shift is already closed or unavailable.');
          this.assertAssignedBranch(employee, lockedShift.branchId);
          const actorPermissions = await this.currentEmployeePermissions(
            tx,
            employee,
            lockedShift.branchId,
          );
          if (!actorPermissions.includes('open_register_shift'))
            throw new ForbiddenException(
              'This employee is no longer authorized to close register shifts.',
            );

          let approvedByEmployeeId: string | null = null;
          if (approverEmployeeId) {
            approvedByEmployeeId = await this.requireCurrentApprover(
              tx,
              employee,
              lockedShift.branchId,
              approverEmployeeId,
              'approve_shift_close',
            );
          }
          const shift = await tx.posShift.findFirstOrThrow({
            where: { id: shiftId, merchantId: employee.merchantId, status: 'open' },
            include: shiftInclude,
          });
          const reconciliation = await buildShiftReconciliation(tx, shift);
          if (reconciliation.unsettledCheckCount > 0)
            throw new ConflictException('Settle or cancel every check before closing this shift.');
          let deliveryHandover: PosDeliveryHandoverSnapshot | null = null;
          if (reconciliation.pendingDeliveryCount) {
            if (!request.deliveryHandover || !approvedByEmployeeId)
              throw new ForbiddenException(
                'Pending deliveries require a named recipient and approval from a different supervisor.',
              );
            const recipient = await tx.posEmployee.findFirst({
              where: {
                merchantId: employee.merchantId,
                username: request.deliveryHandover.recipientUsername,
                active: true,
                branches: {
                  some: { branchId: lockedShift.branchId, branch: { archivedAt: null } },
                },
              },
              select: { id: true, displayName: true, role: true, permissions: true },
            });
            const recipientPermissions = recipient
              ? resolvePosEmployeePermissions(
                  isPosEmployeeRole(recipient.role) ? recipient.role : null,
                  recipient.permissions,
                )
              : [];
            if (
              !recipient ||
              recipient.id === employee.id ||
              !recipientPermissions.includes('sell') ||
              !recipientPermissions.includes('open_register_shift')
            )
              throw new ForbiddenException(
                'Choose a different active cashier or supervisor assigned to this branch.',
              );
            const deliveries = await readDeliveryBalances(tx, employee.merchantId, {
              shiftId,
              limit: 501,
            });
            if (deliveries.length > 500)
              throw new ConflictException(
                'Resolve deliveries until at most 500 follow-ups remain before closing.',
              );
            const approver = await tx.posEmployee.findFirstOrThrow({
              where: { id: approvedByEmployeeId, merchantId: employee.merchantId },
              select: { displayName: true },
            });
            deliveryHandover = {
              recipientEmployeeId: recipient.id,
              recipientName: recipient.displayName,
              approvedByName: approver.displayName,
              deliveries: deliveries.map((d) => ({
                orderId: d.orderId,
                courierName: d.courierName,
                status: d.status,
                customerDue: formatCents(toCents(d.customerDue)),
                courierCashHeld: formatCents(toCents(d.courierCashHeld)),
              })),
            };
            await tx.posDelivery.updateMany({
              where: {
                merchantId: employee.merchantId,
                orderId: { in: deliveries.map((d) => d.orderId) },
                followupShiftId: shiftId,
              },
              data: {
                custodianEmployeeId: recipient.id,
                followupShiftId: null,
                revision: { increment: 1 },
              },
            });
          } else if (request.deliveryHandover) {
            throw new ConflictException(
              'There are no pending deliveries to hand over. Refresh the shift.',
            );
          }
          const countedCash = formatCents(toCents(request.countedCash));
          const varianceCents = toCents(countedCash) - toCents(reconciliation.expectedCash);
          if (varianceCents !== 0n && !request.reason?.trim())
            throw new ConflictException('Enter a reason for the cash variance.');
          if (
            varianceCents !== 0n &&
            !approvedByEmployeeId &&
            !actorPermissions.includes('approve_shift_close')
          )
            throw new ForbiddenException('Supervisor approval is required for a cash variance.');

          const closedAt = new Date();
          const finalReconciliation: PosShiftReconciliationSummary = {
            ...reconciliation,
            countedCash,
            variance: formatCents(varianceCents),
          };
          const report = await tx.posShiftCloseReport.create({
            data: {
              merchantId: employee.merchantId,
              shiftId,
              requestId: request.requestId,
              fingerprint,
              operatorEmployeeId: employee.id,
              approvedByEmployeeId,
              currency: shift.currency,
              openingFloat: finalReconciliation.openingFloat,
              cashSales: finalReconciliation.cashSales,
              deliveryCashReceived: finalReconciliation.deliveryCashReceived ?? '0.00',
              ...(deliveryHandover
                ? { deliveryHandover: deliveryHandover as unknown as Prisma.InputJsonValue }
                : {}),
              cashRefunds: finalReconciliation.cashRefunds,
              cashIn: finalReconciliation.cashIn,
              cashOut: finalReconciliation.cashOut,
              cashDrop: finalReconciliation.cashDrop,
              expectedCash: finalReconciliation.expectedCash,
              countedCash,
              variance: formatCents(varianceCents),
              terminalSales: finalReconciliation.terminalSales,
              terminalRefunds: finalReconciliation.terminalRefunds,
              reason: request.reason?.trim() || null,
              snapshot: finalReconciliation as unknown as Prisma.InputJsonValue,
              closedAt,
            },
            include: closeReportInclude,
          });
          const changed = await tx.posShift.updateMany({
            where: { id: shiftId, merchantId: employee.merchantId, status: 'open' },
            data: { status: 'closed', closedAt },
          });
          if (changed.count !== 1)
            throw new ConflictException('This register shift was closed concurrently.');
          const savedReport = await tx.posShiftCloseReport.findFirstOrThrow({
            where: { id: report.id, merchantId: employee.merchantId },
            include: closeReportInclude,
          });
          return toCloseReport(savedReport);
        },
        { isolationLevel: 'ReadCommitted' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error) || isSerializationConflict(error)) {
        const prior = await this.prisma.posShiftCloseReport.findFirst({
          where: { merchantId: employee.merchantId, requestId: request.requestId },
          include: closeReportInclude,
        });
        if (prior) return this.replayShiftClose(employee, prior, shiftId, fingerprint);
        throw new ConflictException(
          'The shift changed while closing. Refresh the reconciliation and retry.',
        );
      }
      throw error;
    }
  }

  private async currentEmployeePermissions(
    tx: Prisma.TransactionClient,
    employee: PosEmployeeSession,
    branchId: string,
  ) {
    const current = await tx.posEmployee.findFirst({
      where: {
        id: employee.id,
        merchantId: employee.merchantId,
        active: true,
        branches: { some: { branchId, branch: { archivedAt: null } } },
      },
      select: { role: true, permissions: true },
    });
    if (!current)
      throw new ForbiddenException('This employee is not active at the selected branch.');
    return resolvePosEmployeePermissions(
      isPosEmployeeRole(current.role) ? current.role : null,
      current.permissions,
    );
  }

  private async requireCurrentApprover(
    tx: Prisma.TransactionClient,
    actor: PosEmployeeSession,
    branchId: string,
    approverEmployeeId: string,
    permission: 'approve_shift_close' | 'manage_cash_movements',
  ): Promise<string> {
    if (approverEmployeeId === actor.id)
      throw new ForbiddenException('A different supervisor must approve this action.');
    const approver = await tx.posEmployee.findFirst({
      where: {
        id: approverEmployeeId,
        merchantId: actor.merchantId,
        active: true,
        branches: { some: { branchId, branch: { archivedAt: null } } },
      },
      select: { id: true, role: true, permissions: true },
    });
    if (!approver)
      throw new ForbiddenException('The approving employee is not active at this branch.');
    const permissions = resolvePosEmployeePermissions(
      isPosEmployeeRole(approver.role) ? approver.role : null,
      approver.permissions,
    );
    if (!permissions.includes(permission))
      throw new ForbiddenException('The approving employee does not have the required permission.');
    return approver.id;
  }

  private replayManualCashMovement(
    employee: PosEmployeeSession,
    record: ManualCashMovementRecord,
    shiftId: string,
    fingerprint: string,
    db: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<RecordPosShiftCashMovementResponse> {
    if (
      record.shiftId !== shiftId ||
      record.operatorEmployeeId !== employee.id ||
      record.fingerprint !== fingerprint
    )
      throw new ConflictException(
        'This cash movement request ID was already used for another action.',
      );
    return db.posShift
      .findFirst({
        where: { id: shiftId, merchantId: employee.merchantId },
        include: shiftInclude,
      })
      .then(async (shift) => {
        if (!shift) throw new NotFoundException('The register shift was not found.');
        this.assertAssignedBranch(employee, shift.branchId);
        return {
          shiftId,
          reconciliation: toLiveShiftSummary(await buildShiftReconciliation(db, shift)),
          movement: toManualCashMovementSummary(record),
        };
      });
  }

  private replayShiftClose(
    employee: PosEmployeeSession,
    record: CloseReportRecord,
    shiftId: string,
    fingerprint: string,
    _db: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): PosShiftCloseReportContract {
    if (
      record.shiftId !== shiftId ||
      record.operatorEmployeeId !== employee.id ||
      record.fingerprint !== fingerprint
    )
      throw new ConflictException(
        'This shift close request ID was already used for another action.',
      );
    this.assertAssignedBranch(employee, record.shift.branchId);
    return toCloseReport(record);
  }

  async lockOpenShiftForSale(
    tx: Prisma.TransactionClient,
    employee: PosEmployeeSession,
    registerId: string,
  ): Promise<{ id: string; branchId: string }> {
    if (!employee.permissions.includes('sell'))
      throw new ForbiddenException('This employee is not authorized to sell.');
    const rows = await tx.$queryRaw<Array<{ id: string; branchId: string }>>`
      SELECT s."id", s."branchId"
      FROM "pos_shifts" s
      INNER JOIN "pos_registers" r
        ON r."id" = s."registerId" AND r."merchantId" = s."merchantId"
      WHERE s."merchantId" = ${employee.merchantId}::uuid
        AND s."registerId" = ${registerId}::uuid
        AND s."status" = 'open'
        AND r."active" = true
      FOR SHARE OF s
    `;
    const shift = rows[0];
    if (!shift) throw new ConflictException('Open a register shift before confirming a sale.');
    this.assertAssignedBranch(employee, shift.branchId);
    return shift;
  }

  async recordCashSale(
    tx: Prisma.TransactionClient,
    input: {
      merchantId: string;
      shiftId: string;
      paymentId: string;
      operatorEmployeeId: string;
      amount: string;
    },
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "pos_shifts"
      WHERE "id" = ${input.shiftId}::uuid
        AND "merchantId" = ${input.merchantId}::uuid
        AND "status" = 'open'
      FOR SHARE
    `;
    if (rows.length === 0) throw new ConflictException('The register shift is no longer open.');
    await tx.posShiftCashMovement.create({
      data: {
        merchantId: input.merchantId,
        shiftId: input.shiftId,
        paymentId: input.paymentId,
        operatorEmployeeId: input.operatorEmployeeId,
        kind: 'cash_sale',
        amount: input.amount,
      },
    });
  }

  async lockOpenShiftForPayment(
    tx: Prisma.TransactionClient,
    input: { merchantId: string; shiftId: string; branchId: string },
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "pos_shifts"
      WHERE "id" = ${input.shiftId}::uuid
        AND "merchantId" = ${input.merchantId}::uuid
        AND "branchId" = ${input.branchId}::uuid
        AND "status" = 'open'
      FOR SHARE
    `;
    if (rows.length === 0)
      throw new ConflictException('The register shift for this order is not open.');
  }

  /** Orders holds the source/follow-up/receiving shift locks in sorted order. */
  async lockDeliveryReceivingShift(
    tx: Prisma.TransactionClient,
    input: {
      merchantId: string;
      branchId: string;
      shiftId: string;
      followupShiftId: string | null;
    },
  ): Promise<void> {
    await this.lockOpenShiftForPayment(tx, input);
    if (input.followupShiftId && input.followupShiftId !== input.shiftId) {
      const current = await tx.posShift.findFirst({
        where: { id: input.followupShiftId, merchantId: input.merchantId, status: 'open' },
        select: { id: true },
      });
      if (current)
        throw new ConflictException(
          'Close and approve delivery handover before moving follow-up to another drawer.',
        );
    }
  }

  async lockOpenShiftForRefund(
    tx: Prisma.TransactionClient,
    input: { merchantId: string; shiftId: string; branchId: string; employee: PosEmployeeSession },
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT s."id"
      FROM "pos_shifts" s
      INNER JOIN "pos_registers" r
        ON r."id" = s."registerId" AND r."branchId" = s."branchId"
          AND r."merchantId" = s."merchantId" AND r."active" = true
      WHERE s."id" = ${input.shiftId}::uuid
        AND s."merchantId" = ${input.merchantId}::uuid
        AND s."branchId" = ${input.branchId}::uuid
        AND s."status" = 'open'
      FOR SHARE OF s
    `;
    if (rows.length === 0)
      throw new ConflictException('Choose an open register shift for this refund.');
    this.assertAssignedBranch(input.employee, input.branchId);
  }

  async recordCashRefund(
    tx: Prisma.TransactionClient,
    input: {
      merchantId: string;
      shiftId: string;
      refundTenderId: string;
      operatorEmployeeId: string;
      amount: string;
    },
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "pos_shifts"
      WHERE "id" = ${input.shiftId}::uuid
        AND "merchantId" = ${input.merchantId}::uuid
        AND "status" = 'open'
      FOR SHARE
    `;
    if (rows.length === 0)
      throw new ConflictException('The refund register shift is no longer open.');
    await tx.posShiftRefundMovement.create({
      data: {
        merchantId: input.merchantId,
        shiftId: input.shiftId,
        refundTenderId: input.refundTenderId,
        operatorEmployeeId: input.operatorEmployeeId,
        amount: input.amount,
      },
    });
  }

  async openShift(employee: PosEmployeeSession, input: unknown): Promise<PosShiftSummary> {
    this.requireShiftCapability(employee);
    const parsed = parseRequest(openPosShiftSchema, input);
    const openingFloat = normalizeOpeningFloat(parsed.openingFloat);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const prior = await tx.posShift.findFirst({
          where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
          include: shiftInclude,
        });
        if (prior) return toMatchingRetry(prior, employee, parsed.registerId, openingFloat);

        const locked = await tx.$queryRaw<Array<{ id: string; branchId: string; active: boolean }>>`
          SELECT "id", "branchId", "active"
          FROM "pos_registers"
          WHERE "id" = ${parsed.registerId} AND "merchantId" = ${employee.merchantId}
          FOR UPDATE
        `;
        const register = locked[0];
        if (!register || !register.active) throw new NotFoundException('Register was not found.');
        this.assertAssignedBranch(employee, register.branchId);

        // Another identical request may have committed while this transaction waited on the register lock.
        const committedRetry = await tx.posShift.findFirst({
          where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
          include: shiftInclude,
        });
        if (committedRetry) {
          return toMatchingRetry(committedRetry, employee, parsed.registerId, openingFloat);
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
        return toShiftSummary(record);
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const prior = await this.prisma.posShift.findFirst({
        where: { merchantId: employee.merchantId, openRequestId: parsed.requestId },
        include: shiftInclude,
      });
      if (prior) return toMatchingRetry(prior, employee, parsed.registerId, openingFloat);
      throw new ConflictException('A shift is already open on this register.');
    }
  }

  private assertAssignedBranch(employee: PosEmployeeSession, branchId: string): void {
    if (!employee.branches.some((branch) => branch.id === branchId)) {
      throw new ForbiddenException('This employee is not assigned to the selected branch.');
    }
  }

  private requireShiftCapability(employee: PosEmployeeSession): void {
    if (
      !isPosEmployeeRole(employee.role) ||
      !employee.permissions.includes('open_register_shift')
    ) {
      throw new ForbiddenException('This employee is not authorized to use register shifts.');
    }
  }
}

async function lockOpenShiftForCashMovement(
  tx: Prisma.TransactionClient,
  employee: PosEmployeeSession,
  shiftId: string,
): Promise<{ id: string; branchId: string }> {
  const rows = await tx.$queryRaw<Array<{ id: string; branchId: string }>>`
    SELECT s."id", s."branchId"
    FROM "pos_shifts" s
    INNER JOIN "pos_registers" r
      ON r."id" = s."registerId" AND r."branchId" = s."branchId"
        AND r."merchantId" = s."merchantId" AND r."active" = true
    INNER JOIN "branches" b
      ON b."id" = s."branchId" AND b."merchantId" = s."merchantId"
        AND b."archivedAt" IS NULL
    WHERE s."id" = ${shiftId}::uuid
      AND s."merchantId" = ${employee.merchantId}::uuid
      AND s."status" = 'open'
    FOR SHARE OF s
  `;
  const shift = rows[0];
  if (!shift) throw new ConflictException('Choose an open register shift for this cash movement.');
  return shift;
}

async function buildShiftReconciliation(
  db: PrismaClient | Prisma.TransactionClient,
  shift: ShiftRecord,
): Promise<PosShiftReconciliationSummary> {
  const where = { merchantId: shift.merchantId, shiftId: shift.id };
  const [
    cashSalesResult,
    cashRefundsResult,
    manualTotals,
    movementRecords,
    terminalSalesResult,
    terminalRefundsResult,
    unsettled,
    deliveryCash,
    deliveries,
  ] = await Promise.all([
    db.posShiftCashMovement.aggregate({
      where: { ...where, kind: 'cash_sale' },
      _sum: { amount: true },
    }),
    db.posShiftRefundMovement.aggregate({ where, _sum: { amount: true } }),
    db.posShiftManualCashMovement.groupBy({ by: ['kind'], where, _sum: { amount: true } }),
    db.posShiftManualCashMovement.findMany({
      where,
      include: manualCashMovementInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    }),
    db.posOrderPayment.aggregate({
      where: { ...where, method: 'terminal' },
      _sum: { amount: true },
    }),
    db.posOrderRefundTender.aggregate({
      where: { ...where, method: 'terminal' },
      _sum: { amount: true },
    }),
    db.$queryRaw<Array<{ unsettledCheckCount: number; unsettledBalance: string }>>`
      WITH unsettled AS (
        SELECT c."id", GREATEST(c."amount" - COALESCE(SUM(p."amount"), 0), 0) AS due
        FROM "pos_order_checks" c
        INNER JOIN "storefront_orders" o
          ON o."id" = c."orderId" AND o."merchantId" = c."merchantId"
        LEFT JOIN "pos_order_payments" p
          ON p."checkId" = c."id" AND p."orderId" = c."orderId" AND p."merchantId" = c."merchantId"
        WHERE c."merchantId" = ${shift.merchantId}::uuid
          AND o."posShiftId" = ${shift.id}::uuid
          AND o."source" = 'pos'
          AND NOT EXISTS (SELECT 1 FROM "pos_deliveries" d WHERE d."orderId" = o."id" AND d."merchantId" = o."merchantId")
          AND c."settledAt" IS NULL
          AND c."cancelledAt" IS NULL
        GROUP BY c."id", c."amount"
      )
      SELECT COUNT(*)::int AS "unsettledCheckCount",
        COALESCE(SUM(due), 0)::text AS "unsettledBalance"
      FROM unsettled
    `,
    db.posDeliveryRemittance.aggregate({ where, _sum: { amount: true } }),
    readDeliveryBalances(db, shift.merchantId, { shiftId: shift.id, limit: 501 }),
  ]);

  const sum = (value: { toString(): string } | null | undefined): bigint =>
    value ? toSignedCents(value.toString()) : 0n;
  const cashRefundMovement = sum(cashRefundsResult._sum.amount);
  const cashIn = manualTotals
    .filter((row) => row.kind === 'cash_in')
    .reduce((total, row) => total + sum(row._sum.amount), 0n);
  const cashOut = manualTotals
    .filter((row) => row.kind === 'cash_out')
    .reduce((total, row) => total + sum(row._sum.amount), 0n);
  const cashDrop = manualTotals
    .filter((row) => row.kind === 'cash_drop')
    .reduce((total, row) => total + sum(row._sum.amount), 0n);
  const cashSales = sum(cashSalesResult._sum.amount);
  const openingFloat = toCents(shift.openingFloat.toFixed(2));
  const deliveryCashReceived = sum(deliveryCash._sum.amount);
  const expectedCash =
    openingFloat +
    cashSales +
    deliveryCashReceived +
    cashRefundMovement +
    cashIn -
    cashOut -
    cashDrop;
  const counts = unsettled[0] ?? { unsettledCheckCount: 0, unsettledBalance: '0.00' };

  return {
    shiftId: shift.id,
    branchId: shift.branchId,
    registerId: shift.registerId,
    registerName: shift.register.name,
    currency: 'EGP',
    openingFloat: formatCents(openingFloat),
    cashSales: formatCents(cashSales),
    deliveryCashReceived: formatCents(deliveryCashReceived),
    pendingDeliveryCount: deliveries[0]?.pendingTotalCount ?? 0,
    pendingDeliveryBalance: formatCents(toCents(deliveries[0]?.pendingTotalBalance ?? '0.00')),
    cashRefunds: formatCents(cashRefundMovement < 0n ? -cashRefundMovement : cashRefundMovement),
    cashIn: formatCents(cashIn),
    cashOut: formatCents(cashOut),
    cashDrop: formatCents(cashDrop),
    expectedCash: formatCents(expectedCash),
    countedCash: null,
    variance: null,
    terminalSales: formatCents(sum(terminalSalesResult._sum.amount)),
    terminalRefunds: formatCents(sum(terminalRefundsResult._sum.amount)),
    unsettledCheckCount: counts.unsettledCheckCount,
    unsettledBalance: formatCents(toSignedCents(counts.unsettledBalance)),
    manualMovements: movementRecords.map(toManualCashMovementSummary),
  };
}

function toManualCashMovementSummary(
  movement: ManualCashMovementRecord,
): PosShiftManualCashMovementSummary {
  return {
    id: movement.id,
    requestId: movement.requestId,
    kind: movement.kind as 'cash_in' | 'cash_out' | 'cash_drop',
    amount: movement.amount.toFixed(2),
    dropReference: movement.dropReference,
    reason: movement.reason,
    createdAt: movement.createdAt.toISOString(),
    operatorName: movement.operator.displayName,
    approvedByName: movement.approvedBy?.displayName ?? null,
  };
}

function toLiveShiftSummary(reconciliation: PosShiftReconciliationSummary): PosShiftLiveSummary {
  return {
    shiftId: reconciliation.shiftId,
    branchId: reconciliation.branchId,
    registerId: reconciliation.registerId,
    registerName: reconciliation.registerName,
    currency: reconciliation.currency,
    unsettledCheckCount: reconciliation.unsettledCheckCount,
    unsettledBalance: reconciliation.unsettledBalance,
    manualMovements: reconciliation.manualMovements,
    pendingDeliveryCount: reconciliation.pendingDeliveryCount ?? 0,
    pendingDeliveryBalance: reconciliation.pendingDeliveryBalance ?? '0.00',
  };
}

function toCloseReport(report: CloseReportRecord): PosShiftCloseReportContract {
  const snapshot = report.snapshot as unknown as PosShiftReconciliationSummary;
  return {
    ...snapshot,
    id: report.id,
    requestId: report.requestId,
    shiftId: report.shiftId,
    currency: report.currency as 'EGP',
    openingFloat: report.openingFloat.toFixed(2),
    cashSales: report.cashSales.toFixed(2),
    deliveryCashReceived: report.deliveryCashReceived.toFixed(2),
    deliveryHandover: report.deliveryHandover as unknown as PosDeliveryHandoverSnapshot | null,
    cashRefunds: report.cashRefunds.toFixed(2),
    cashIn: report.cashIn.toFixed(2),
    cashOut: report.cashOut.toFixed(2),
    cashDrop: report.cashDrop.toFixed(2),
    expectedCash: report.expectedCash.toFixed(2),
    countedCash: report.countedCash.toFixed(2),
    variance: report.variance.toFixed(2),
    terminalSales: report.terminalSales.toFixed(2),
    terminalRefunds: report.terminalRefunds.toFixed(2),
    closedAt: report.closedAt.toISOString(),
    operatorName: report.operator.displayName,
    approvedByName: report.approvedBy?.displayName ?? null,
    reason: report.reason,
  };
}

function toOwnerCloseReportRow(report: OwnerCloseReportRecord): PosShiftCloseReportRow {
  return {
    id: report.id,
    shiftId: report.shiftId,
    branchId: report.shift.branchId,
    branchName: report.shift.branch.name,
    registerName: report.shift.register.name,
    openedAt: report.shift.openedAt.toISOString(),
    closedAt: report.closedAt.toISOString(),
    openedByName: report.shift.openedBy.displayName,
    operatorName: report.operator.displayName,
    approvedByName: report.approvedBy?.displayName ?? null,
    currency: report.currency as 'EGP',
    openingFloat: report.openingFloat.toFixed(2),
    cashSales: report.cashSales.toFixed(2),
    deliveryCashReceived: report.deliveryCashReceived.toFixed(2),
    deliveryHandover: report.deliveryHandover as unknown as PosDeliveryHandoverSnapshot | null,
    cashRefunds: report.cashRefunds.toFixed(2),
    cashIn: report.cashIn.toFixed(2),
    cashOut: report.cashOut.toFixed(2),
    cashDrop: report.cashDrop.toFixed(2),
    expectedCash: report.expectedCash.toFixed(2),
    countedCash: report.countedCash.toFixed(2),
    variance: report.variance.toFixed(2),
    terminalSales: report.terminalSales.toFixed(2),
    terminalRefunds: report.terminalRefunds.toFixed(2),
    reason: report.reason,
  };
}

function toMatchingRetry(
  shift: ShiftRecord,
  employee: PosEmployeeSession,
  registerId: string,
  openingFloat: string,
): PosShiftSummary {
  if (!employee.branches.some((branch) => branch.id === shift.branchId)) {
    throw new ForbiddenException('This employee is not assigned to the selected branch.');
  }
  if (
    shift.registerId !== registerId ||
    shift.openedByEmployeeId !== employee.id ||
    shift.openingFloat.toFixed(2) !== openingFloat
  ) {
    throw new ConflictException('This request ID was already used for a different shift opening.');
  }
  if (shift.status !== 'open') {
    throw new ConflictException('This shift opening request has already been resolved.');
  }
  return toShiftSummary(shift);
}

function toRegisterSummary(register: RegisterRecord): PosRegisterSummary {
  return {
    id: register.id,
    branchId: register.branchId,
    branchName: register.branch.name,
    name: register.name,
    active: register.active,
    revision: register.revision,
  };
}

function toShiftSummary(shift: ShiftRecord): PosShiftSummary {
  if (shift.status !== 'open') throw new ConflictException('This shift is no longer open.');
  return {
    id: shift.id,
    branchId: shift.branchId,
    registerId: shift.registerId,
    registerName: shift.register.name,
    openedByEmployeeId: shift.openedBy.id,
    openedByName: shift.openedBy.displayName,
    openRequestId: shift.openRequestId,
    openingFloat: shift.openingFloat.toFixed(2),
    currency: 'EGP',
    openedAt: shift.openedAt.toISOString(),
    status: 'open',
  };
}
