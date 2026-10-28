import { NotFoundException } from '@nestjs/common';
import type { CashSafeMovementSummary, CursorPage } from '@waffarly/contracts';
import type { PrismaClient } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import type { CashPageQuery } from './cash-custody.schemas.js';

export async function readDrawerLedger(
  db: PrismaClient,
  merchantId: string,
  shiftId: string,
  q: CashPageQuery,
): Promise<CursorPage<CashSafeMovementSummary>> {
  if (!(await db.posShift.findFirst({ where: { id: shiftId, merchantId } })))
    throw new NotFoundException('Shift not found.');
  const result = await db.$queryRaw<
    Array<{ cursorValid: boolean; items: CashSafeMovementSummary[] }>
  >`
    WITH events AS (
      SELECT "id", 'opening'::text AS kind, "openingFloat" AS amount, 'Opening float'::text AS reason,
        'pos:' || "openedByEmployeeId"::text AS actor, "openedAt" AS at, NULL::uuid AS transfer
        FROM "pos_shifts" WHERE "merchantId"=${merchantId}::uuid AND "id"=${shiftId}::uuid
      UNION ALL
      SELECT "id", 'cash_sale', "amount", 'Cash sale / payment ' || "paymentId"::text,
        'pos:' || "operatorEmployeeId"::text, "createdAt", NULL::uuid
        FROM "pos_shift_cash_movements" WHERE "merchantId"=${merchantId}::uuid AND "shiftId"=${shiftId}::uuid
      UNION ALL
      SELECT "id", 'cash_refund', "amount", 'Cash refund', 'pos:' || "operatorEmployeeId"::text, "createdAt", NULL::uuid
        FROM "pos_shift_refund_movements" WHERE "merchantId"=${merchantId}::uuid AND "shiftId"=${shiftId}::uuid
      UNION ALL
      SELECT "id", "kind", CASE WHEN "kind"='cash_in' THEN "amount" ELSE -"amount" END,
        "reason" || COALESCE(' / ' || "dropReference", ''), 'pos:' || "operatorEmployeeId"::text, "createdAt", NULL::uuid
        FROM "pos_shift_manual_cash_movements" WHERE "merchantId"=${merchantId}::uuid AND "shiftId"=${shiftId}::uuid
      UNION ALL
      SELECT "id", 'delivery_receipt', "amount", 'Courier cash received', 'pos:' || "operatorEmployeeId"::text, "createdAt", NULL::uuid
        FROM "pos_delivery_remittances" WHERE "merchantId"=${merchantId}::uuid AND "shiftId"=${shiftId}::uuid
      UNION ALL
      SELECT "id", 'count_variance', "variance", 'Physical count variance', 'pos:' || "operatorEmployeeId"::text, "closedAt", NULL::uuid
        FROM "pos_shift_close_reports" WHERE "merchantId"=${merchantId}::uuid AND "shiftId"=${shiftId}::uuid
      UNION ALL
      SELECT "id", CASE WHEN "destinationSafeId" IS NULL THEN 'carryover' ELSE 'safe_transfer' END,
        -"amount", "reason" || ' / ' || "reference", "createdBy", "createdAt", "id"
        FROM "pos_cash_transfers" WHERE "merchantId"=${merchantId}::uuid AND "sourceShiftId"=${shiftId}::uuid AND "manualMovementId" IS NULL
    ), balances AS (
      SELECT *, SUM(amount) OVER (ORDER BY at, id ROWS UNBOUNDED PRECEDING) AS balance FROM events
    ), anchor AS (SELECT at, id FROM balances WHERE id=${q.cursor ?? null}::uuid), limited AS (
      SELECT b.id, b.kind, b.amount::text AS amount, b.balance::text AS "balanceAfter", b.reason,
        COALESCE(e."displayName", regexp_replace(b.actor, '^owner:', '')) AS "createdBy", b.at AS "createdAt", b.transfer AS "transferId"
        FROM balances b LEFT JOIN "pos_employees" e ON 'pos:' || e.id::text=b.actor AND e."merchantId"=${merchantId}::uuid
        WHERE ${q.cursor ?? null}::uuid IS NULL OR (b.at, b.id) < (SELECT at, id FROM anchor)
        ORDER BY b.at DESC, b.id DESC LIMIT ${q.limit + 1}
    ) SELECT (${q.cursor ?? null}::uuid IS NULL OR EXISTS(SELECT 1 FROM anchor)) AS "cursorValid",
      COALESCE((SELECT json_agg(limited) FROM limited), '[]'::json) AS items`;
  assertScopedCursor(q.cursor, result[0]?.cursorValid ?? false);
  const rows = result[0]?.items ?? [];
  const items = rows.slice(0, q.limit);
  return { items, nextCursor: rows.length > q.limit ? (items.at(-1)?.id ?? null) : null };
}
