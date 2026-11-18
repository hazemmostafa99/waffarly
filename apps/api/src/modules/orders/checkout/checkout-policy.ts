/**
 * Checks whether a discount can be used and which branch can receive a website order.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { OrderDiscountSnapshot } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';

import { formatCents, toCents } from '../../../common/money/money.js';

export function currentCairoDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}-${parts.find((part) => part.type === 'day')!.value}`;
}

export async function resolveRestaurantReceivingBranch(
  db: Prisma.TransactionClient,
  merchantId: string,
) {
  const branches = await db.branch.findMany({
    where: { merchantId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
    take: 2,
  });
  if (branches.length !== 1) {
    throw new ConflictException(
      branches.length === 0
        ? 'المطعم ليس لديه فرع متاح لاستقبال الطلبات حاليًا.'
        : 'يلزم تحديد فرع استقبال طلبات المطعم قبل تأكيد الطلب.',
    );
  }
  return branches[0]!;
}

export async function quoteCheckoutDiscount(
  db: Prisma.TransactionClient,
  merchantId: string,
  code: string | undefined,
  subtotal: bigint,
) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  const row = await db.merchantDiscount.findFirst({
    where: { merchantId, code: normalized },
    include: { branches: { select: { branchId: true } } },
  });
  const unavailable = () =>
    new BadRequestException('Discount code is not available for this order.');
  const today = currentCairoDate();
  if (
    !row ||
    row.state !== 'published' ||
    row.startDate.toISOString().slice(0, 10) > today ||
    row.endDate.toISOString().slice(0, 10) < today ||
    (row.usageLimit !== null && row.usedCount >= row.usageLimit) ||
    row.branches.length > 0
  )
    throw unavailable();
  if (subtotal < toCents(row.minimum.toString()))
    throw new BadRequestException('Order does not meet the discount minimum.');
  const value = toCents(row.value.toString());
  let amount = row.type === 'fixed' ? value : (subtotal * value + 5_000n) / 10_000n;
  if (row.maximum !== null)
    amount = amount < toCents(row.maximum.toString()) ? amount : toCents(row.maximum.toString());
  if (amount > subtotal) amount = subtotal;
  if (amount <= 0n) throw unavailable();
  const snapshot: OrderDiscountSnapshot = {
    code: row.code,
    name: row.name,
    type: row.type as OrderDiscountSnapshot['type'],
    value: row.value.toString(),
    amount: formatCents(amount),
    terms: row.terms,
  };
  return { row, snapshot };
}

/** Allocate a saved order discount across item revenue using exact cent shares. */
export function allocateCheckoutLineRevenue(
  lines: readonly { id: string; position: number; lineTotal: string }[],
  discountAmount?: string,
): Array<{ lineId: string; revenueAmount: string }> {
  // 1. Use each saved pre-discount line total as its proportional weight.
  const lineCents = lines.map((line) => toCents(line.lineTotal));
  const subtotalCents = lineCents.reduce((total, line) => total + line, 0n);
  const discountCents = discountAmount ? toCents(discountAmount) : 0n;
  if (discountCents > subtotalCents) {
    throw new ConflictException('The saved discount exceeds the order line total.');
  }

  // 2. Distribute leftover cents by largest fractional share, with stable line ordering.
  const shares = lineCents.map((weight, index) => {
    const numerator = discountCents * weight;
    return {
      index,
      baseCents: subtotalCents === 0n ? 0n : numerator / subtotalCents,
      remainder: subtotalCents === 0n ? 0n : numerator % subtotalCents,
    };
  });
  const allocatedCents = shares.reduce((total, share) => total + share.baseCents, 0n);
  const leftoverCents = Number(discountCents - allocatedCents);
  shares.sort((left, right) => {
    if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
    const leftLine = lines[left.index]!;
    const rightLine = lines[right.index]!;
    return (
      leftLine.position - rightLine.position ||
      (leftLine.id < rightLine.id ? -1 : leftLine.id > rightLine.id ? 1 : 0)
    );
  });
  for (let index = 0; index < leftoverCents; index += 1) {
    shares[index]!.baseCents += 1n;
  }

  const discountByLine = new Map(shares.map((share) => [share.index, share.baseCents]));
  return lines.map((line, index) => ({
    lineId: line.id,
    revenueAmount: formatCents(lineCents[index]! - discountByLine.get(index)!),
  }));
}
