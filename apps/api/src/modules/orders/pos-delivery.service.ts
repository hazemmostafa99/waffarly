import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  isPosEmployeeRole,
  resolvePosEmployeePermissions,
  type CursorPage,
  type PosDeliveryCommand,
  type PosDeliverySummary,
  type PosEmployeeSession,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../infrastructure/database/prisma-errors.js';
import { formatCents, toCents } from '../../common/money/money.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { readDeliveryBalances, ShiftsService } from '../shifts/index.js';
import { posDeliveryCommandSchema, posDeliveryListSchema } from './pos-delivery.schemas.js';

@Injectable()
export class PosDeliveryService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(ShiftsService) private readonly shifts: ShiftsService,
  ) {}

  async requestStatus(employee: PosEmployeeSession, orderId: string, requestId: string) {
    const order = await this.db.storefrontOrder.findFirst({
      where: {
        id: orderId,
        merchantId: employee.merchantId,
        source: 'pos',
        fulfillmentType: 'delivery',
      },
      select: { branchId: true },
    });
    if (!order?.branchId) throw new NotFoundException('The delivery order was not found.');
    this.requireBranch(employee, order.branchId);
    const action = await this.db.storefrontOrderAction.findUnique({
      where: { merchantId_requestId: { merchantId: employee.merchantId, requestId } },
    });
    if (!action) return { committed: false };
    if (
      action.orderId !== orderId ||
      action.createdBy !== `pos:${employee.id}` ||
      !['pos_delivery', 'pos_payment'].includes(action.action)
    )
      throw new ForbiddenException(
        'This saved action does not belong to the current employee and order.',
      );
    const discarded =
      action.action === 'pos_delivery' &&
      action.result !== null &&
      typeof action.result === 'object' &&
      !Array.isArray(action.result) &&
      action.result.discarded === true;
    return discarded ? { committed: false, discarded: true } : { committed: true };
  }

  /** Reserve a rejected ID under the same order lock used by financial writes.
   * A late original request must never commit after recovery is dismissed. */
  async abandonRequest(employee: PosEmployeeSession, orderId: string, requestId: string) {
    return this.db.$transaction(async (tx) => {
      const order = await tx.storefrontOrder.findFirst({
        where: {
          id: orderId,
          merchantId: employee.merchantId,
          source: 'pos',
          fulfillmentType: 'delivery',
        },
        select: { branchId: true },
      });
      if (!order?.branchId) throw new NotFoundException('The delivery order was not found.');
      this.requireBranch(employee, order.branchId);
      await this.currentPermissions(tx, employee, order.branchId);
      await tx.$queryRaw`SELECT "id" FROM "storefront_orders" WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR UPDATE`;
      const prior = await tx.storefrontOrderAction.findUnique({
        where: { merchantId_requestId: { merchantId: employee.merchantId, requestId } },
      });
      if (prior) {
        if (
          prior.orderId !== orderId ||
          prior.createdBy !== `pos:${employee.id}` ||
          !['pos_delivery', 'pos_payment'].includes(prior.action)
        )
          throw new ForbiddenException(
            'This saved action does not belong to the current employee and order.',
          );
        const discarded =
          prior.action === 'pos_delivery' &&
          prior.result !== null &&
          typeof prior.result === 'object' &&
          !Array.isArray(prior.result) &&
          prior.result.discarded === true;
        return { committed: !discarded, discarded };
      }
      const fingerprint = createHash('sha256')
        .update(JSON.stringify({ discarded: true, orderId, requestId }))
        .digest('hex');
      await tx.storefrontOrderAction.create({
        data: {
          merchantId: employee.merchantId,
          orderId,
          requestId,
          action: 'pos_delivery',
          createdBy: `pos:${employee.id}`,
          fingerprint,
          result: { orderId, branchId: order.branchId, discarded: true },
        },
      });
      return { committed: false, discarded: true };
    });
  }

  async list(
    employee: PosEmployeeSession,
    input: unknown,
  ): Promise<CursorPage<PosDeliverySummary>> {
    const query = parseRequest(posDeliveryListSchema, input);
    this.requireBranch(employee, query.branchId);
    if (
      query.cursor &&
      !(
        await readDeliveryBalances(this.db, employee.merchantId, {
          branchId: query.branchId,
          orderId: query.cursor,
          pendingOnly: !query.includeResolved,
          limit: 1,
        })
      ).length
    )
      throw new NotFoundException('Delivery cursor was not found in this branch.');
    const rows = await readDeliveryBalances(this.db, employee.merchantId, {
      ...query,
      pendingOnly: !query.includeResolved,
      limit: query.limit + 1,
    });
    const items = await this.summaries(employee, rows.slice(0, query.limit));
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.orderId : null };
  }

  async ready(employee: PosEmployeeSession, input: unknown) {
    const query = parseRequest(posDeliveryListSchema, input);
    this.requireBranch(employee, query.branchId);
    const where: Prisma.StorefrontOrderWhereInput = {
      merchantId: employee.merchantId,
      branchId: query.branchId,
      source: 'pos',
      fulfillmentType: 'delivery',
      status: 'ready',
      delivery: { is: null },
    };
    if (
      query.cursor &&
      !(await this.db.storefrontOrder.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Delivery cursor was not found in this branch.');
    const rows = await this.db.storefrontOrder.findMany({
      where: { ...where, ...(query.cursor ? { id: { lt: query.cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: { id: true, revision: true, total: true, customerName: true },
    });
    return {
      items: rows.slice(0, query.limit).map((row) => ({ ...row, total: row.total.toFixed(2) })),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    };
  }

  async summary(
    employee: PosEmployeeSession,
    orderId: string,
    tx: Prisma.TransactionClient | PrismaService = this.db,
  ): Promise<PosDeliverySummary> {
    const [row] = await readDeliveryBalances(tx, employee.merchantId, {
      orderId,
      pendingOnly: false,
      limit: 1,
    });
    if (!row) throw new NotFoundException('The delivery was not found.');
    this.requireBranch(employee, row.branchId);
    return (await this.summaries(employee, [row], tx))[0]!;
  }

  private async summaries(
    employee: PosEmployeeSession,
    rows: Awaited<ReturnType<typeof readDeliveryBalances>>,
    tx: Prisma.TransactionClient | PrismaService = this.db,
  ): Promise<PosDeliverySummary[]> {
    if (!rows.length) return [];
    const allChecks = await tx.posOrderCheck.findMany({
      where: {
        merchantId: employee.merchantId,
        orderId: { in: rows.map((row) => row.orderId) },
        cancelledAt: null,
      },
      select: {
        id: true,
        orderId: true,
        position: true,
        amount: true,
        payments: {
          select: {
            id: true,
            amount: true,
            cashCustody: true,
            deliveryRemittances: {
              select: {
                amount: true,
                shiftId: true,
                createdAt: true,
                operator: { select: { displayName: true } },
              },
            },
          },
        },
      },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => {
      const checks = allChecks.filter((check) => check.orderId === row.orderId);
      return {
        orderId: row.orderId,
        branchId: row.branchId,
        sourceShiftId: row.sourceShiftId,
        followupShiftId: row.followupShiftId,
        revision: row.revision,
        orderRevision: row.orderRevision,
        orderStatus: row.orderStatus,
        courierName: row.courierName,
        status: row.status,
        failureReason: row.failureReason,
        custodianName: row.custodianName,
        custodianEmployeeId: row.custodianEmployeeId,
        customerDue: formatCents(toCents(row.customerDue)),
        courierCashHeld: formatCents(toCents(row.courierCashHeld)),
        dispatchedAt: row.dispatchedAt.toISOString(),
        deliveredAt: row.deliveredAt?.toISOString() ?? null,
        checks: checks.map((check) => ({
          id: check.id,
          position: check.position,
          balanceDue: formatCents(
            toCents(check.amount.toFixed(2)) -
              check.payments.reduce((sum, p) => sum + toCents(p.amount.toFixed(2)), 0n),
          ),
        })),
        courierPayments: checks.flatMap((check) =>
          check.payments
            .filter((p) => p.cashCustody === 'courier')
            .map((p) => ({
              id: p.id,
              amount: p.amount.toFixed(2),
              remaining: formatCents(
                toCents(p.amount.toFixed(2)) -
                  p.deliveryRemittances.reduce((sum, r) => sum + toCents(r.amount.toFixed(2)), 0n),
              ),
            })),
        ),
        remittances: checks.flatMap((check) =>
          check.payments.flatMap((payment) =>
            payment.deliveryRemittances.map((r) => ({
              amount: r.amount.toFixed(2),
              shiftId: r.shiftId,
              operatorName: r.operator.displayName,
              receivedAt: r.createdAt.toISOString(),
            })),
          ),
        ),
      };
    });
  }

  async command(
    employee: PosEmployeeSession,
    orderId: string,
    input: unknown,
  ): Promise<PosDeliverySummary> {
    const command: PosDeliveryCommand = parseRequest(posDeliveryCommandSchema, input);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ orderId, command }))
      .digest('hex');
    const replay = (previous: {
      orderId: string;
      action: string;
      fingerprint: string;
      createdBy: string;
      result: Prisma.JsonValue;
    }) => {
      if (
        previous.orderId !== orderId ||
        previous.action !== 'pos_delivery' ||
        previous.fingerprint !== fingerprint ||
        previous.createdBy !== `pos:${employee.id}`
      )
        throw new ConflictException(
          'This delivery request ID was already used for another action.',
        );
      const result = previous.result as unknown as PosDeliverySummary;
      this.requireBranch(employee, result.branchId);
      return result;
    };
    const prior = await this.db.storefrontOrderAction.findUnique({
      where: {
        merchantId_requestId: { merchantId: employee.merchantId, requestId: command.requestId },
      },
    });
    if (prior) return replay(prior);
    try {
      return await this.db.$transaction(
        async (tx) => {
          const observed = await tx.storefrontOrder.findFirst({
            where: {
              id: orderId,
              merchantId: employee.merchantId,
              source: 'pos',
              fulfillmentType: 'delivery',
            },
            select: {
              branchId: true,
              posShiftId: true,
              delivery: { select: { followupShiftId: true } },
            },
          });
          if (!observed?.branchId || !observed.posShiftId)
            throw new NotFoundException('The POS delivery order was not found.');
          this.requireBranch(employee, observed.branchId);
          const permissions = await this.currentPermissions(tx, employee, observed.branchId);
          const shiftIds = [
            ...new Set(
              [
                observed.posShiftId,
                observed.delivery?.followupShiftId,
                ...('receivingShiftId' in command ? [command.receivingShiftId] : []),
              ].filter((id): id is string => Boolean(id)),
            ),
          ].sort();
          for (const shiftId of shiftIds)
            await tx.$queryRaw`SELECT "id" FROM "pos_shifts" WHERE "id" = ${shiftId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR SHARE`;
          if ('receivingShiftId' in command)
            await this.shifts.lockDeliveryReceivingShift(tx, {
              merchantId: employee.merchantId,
              branchId: observed.branchId,
              shiftId: command.receivingShiftId,
              followupShiftId: observed.delivery?.followupShiftId ?? null,
            });
          await tx.$queryRaw`SELECT "id" FROM "storefront_orders" WHERE "id" = ${orderId}::uuid AND "merchantId" = ${employee.merchantId}::uuid FOR UPDATE`;
          const existingAction = await tx.storefrontOrderAction.findUnique({
            where: {
              merchantId_requestId: {
                merchantId: employee.merchantId,
                requestId: command.requestId,
              },
            },
          });
          if (existingAction) return replay(existingAction);
          const order = await tx.storefrontOrder.findFirstOrThrow({
            where: { id: orderId, merchantId: employee.merchantId },
            include: { delivery: true },
          });
          if (order.delivery?.followupShiftId !== observed.delivery?.followupShiftId)
            throw new ConflictException('Delivery responsibility changed. Refresh and retry.');
          if (command.action === 'dispatch') {
            if (order.status !== 'ready' || (order.delivery && order.delivery.status !== 'failed'))
              throw new ConflictException(
                'Only ready delivery orders or failed deliveries can be dispatched.',
              );
            if ((order.delivery?.revision ?? order.revision) !== command.revision)
              throw new ConflictException('The delivery order changed. Refresh and retry.');
            if (!order.delivery)
              await this.shifts.lockOpenShiftForPayment(tx, {
                merchantId: employee.merchantId,
                branchId: observed.branchId,
                shiftId: observed.posShiftId,
              });
            if (order.delivery) {
              const [balance] = await readDeliveryBalances(tx, employee.merchantId, {
                orderId,
                pendingOnly: false,
                limit: 1,
              });
              if (balance && toCents(balance.courierCashHeld) > 0n)
                throw new ConflictException(
                  'Receive the previous courier cash before redispatching.',
                );
              this.requireCustodian(employee, order.delivery.custodianEmployeeId, permissions);
            }
            await tx.posDelivery.upsert({
              where: { orderId },
              create: {
                orderId,
                merchantId: employee.merchantId,
                branchId: observed.branchId,
                followupShiftId: observed.posShiftId,
                custodianEmployeeId: employee.id,
                courierName: command.courierName,
              },
              update: {
                courierName: command.courierName,
                status: 'out_for_delivery',
                failureReason: null,
                dispatchedAt: new Date(),
                revision: { increment: 1 },
              },
            });
          } else {
            const delivery = order.delivery;
            if (!delivery || delivery.revision !== command.revision)
              throw new ConflictException('The delivery changed. Refresh and retry.');
            if (command.action === 'claim') {
              this.requireCustodian(employee, delivery.custodianEmployeeId, permissions);
              await tx.posDelivery.update({
                where: { orderId },
                data: {
                  custodianEmployeeId: employee.id,
                  followupShiftId: command.receivingShiftId,
                  revision: { increment: 1 },
                },
              });
            } else if (command.action === 'remit') {
              this.requireCustodian(employee, delivery.custodianEmployeeId, permissions);
              const payment = await tx.posOrderPayment.findFirst({
                where: {
                  id: command.paymentId,
                  orderId,
                  merchantId: employee.merchantId,
                  method: 'cash',
                  cashCustody: 'courier',
                },
                include: { deliveryRemittances: { select: { amount: true } } },
              });
              if (!payment) throw new NotFoundException('The courier cash payment was not found.');
              const held =
                toCents(payment.amount.toFixed(2)) -
                payment.deliveryRemittances.reduce(
                  (sum, r) => sum + toCents(r.amount.toFixed(2)),
                  0n,
                );
              if (toCents(command.amount) > held)
                throw new ConflictException(
                  'The received amount exceeds the cash still held by the courier.',
                );
              await tx.posDeliveryRemittance.create({
                data: {
                  merchantId: employee.merchantId,
                  branchId: observed.branchId,
                  orderId,
                  paymentId: payment.id,
                  shiftId: command.receivingShiftId,
                  operatorEmployeeId: employee.id,
                  requestId: command.requestId,
                  amount: command.amount,
                },
              });
              await tx.posDelivery.update({
                where: { orderId },
                data: {
                  followupShiftId: command.receivingShiftId,
                  custodianEmployeeId: employee.id,
                  revision: { increment: 1 },
                },
              });
            } else {
              this.requireCustodian(employee, delivery.custodianEmployeeId, permissions);
              if (delivery.status !== 'out_for_delivery')
                throw new ConflictException(
                  'Only an outgoing delivery can be marked delivered or failed.',
                );
              const delivered = command.action === 'delivered';
              await tx.posDelivery.update({
                where: { orderId },
                data: {
                  status: delivered ? 'delivered' : 'failed',
                  deliveredAt: delivered ? new Date() : null,
                  failureReason: command.action === 'failed' ? command.reason : null,
                  revision: { increment: 1 },
                },
              });
              if (delivered)
                await tx.storefrontOrder.update({
                  where: { id: orderId },
                  data: { status: 'completed', completedAt: new Date() },
                });
            }
          }
          await tx.storefrontOrder.update({
            where: { id: orderId },
            data: { revision: { increment: 1 } },
          });
          const result = await this.summary(employee, orderId, tx);
          await tx.storefrontOrderAction.create({
            data: {
              merchantId: employee.merchantId,
              orderId,
              requestId: command.requestId,
              action: 'pos_delivery',
              fingerprint,
              createdBy: `pos:${employee.id}`,
              result: result as unknown as Prisma.InputJsonValue,
            },
          });
          return result;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isSerializationConflict(error) || isUniqueConstraintError(error)) {
        const previous = await this.db.storefrontOrderAction.findUnique({
          where: {
            merchantId_requestId: { merchantId: employee.merchantId, requestId: command.requestId },
          },
        });
        if (previous) return replay(previous);
        throw new ConflictException(
          'The delivery changed concurrently. Refresh and retry the same request.',
        );
      }
      throw error;
    }
  }

  private requireBranch(employee: PosEmployeeSession, branchId: string) {
    if (
      !employee.permissions.includes('sell') ||
      !employee.branches.some((branch) => branch.id === branchId && branch.archivedAt === null)
    )
      throw new ForbiddenException('This employee cannot manage deliveries at this branch.');
  }
  private requireCustodian(
    employee: PosEmployeeSession,
    custodianId: string,
    permissions: readonly string[],
  ) {
    if (custodianId !== employee.id && !permissions.includes('approve_shift_close'))
      throw new ForbiddenException(
        'Only the responsible employee or a supervisor can manage this delivery.',
      );
  }
  private async currentPermissions(
    tx: Prisma.TransactionClient,
    employee: PosEmployeeSession,
    branchId: string,
  ) {
    const actor = await tx.posEmployee.findFirst({
      where: {
        id: employee.id,
        merchantId: employee.merchantId,
        active: true,
        branches: { some: { branchId, branch: { archivedAt: null } } },
      },
      select: { role: true, permissions: true },
    });
    const permissions = actor
      ? resolvePosEmployeePermissions(
          isPosEmployeeRole(actor.role) ? actor.role : null,
          actor.permissions,
        )
      : [];
    if (!permissions.includes('sell'))
      throw new ForbiddenException('This employee is no longer authorized to manage deliveries.');
    return permissions;
  }
}
