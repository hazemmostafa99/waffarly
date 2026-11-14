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
