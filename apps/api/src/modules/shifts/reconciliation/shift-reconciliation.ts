/** Calculates the drawer and payment facts needed to reconcile a shift. */
import { toManualCashMovementSummary } from '../shift.mapper.js';

import { readDeliveryBalances } from '../delivery-reconciliation.js';

import type { PosShiftReconciliationSummary } from '@waffarly/contracts';
import type { Prisma, PrismaClient } from '@waffarly/database';

import { formatCents, toCents, toSignedCents } from '../../../common/money/money.js';

import { type ShiftRecord, manualCashMovementInclude } from '../shift-records.js';

export async function buildShiftReconciliation(
  db: PrismaClient | Prisma.TransactionClient,
  shift: Pick<
    ShiftRecord,
    'id' | 'merchantId' | 'branchId' | 'registerId' | 'register' | 'openingFloat'
  >,
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
          AND (o."source" = 'pos' OR (o."source" = 'storefront' AND o."fulfillmentType" = 'pickup'))
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
