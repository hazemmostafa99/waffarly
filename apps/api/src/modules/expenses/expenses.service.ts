/** Records categorized expenses, private receipts and safe-linked payments. */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { ExpenseMonthSummary, MerchantExpenseSummary } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { formatCents, toCents } from '../../common/money/money.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrivateMediaStorage } from '../../infrastructure/storage/private-media-storage.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { recordSafeMovementInTransaction } from '../shifts/index.js';
import {
  createExpenseSchema,
  expenseMonthSchema,
  listExpensesSchema,
  monthStartDate,
  recordExpensePaymentSchema,
  updateExpenseSchema,
} from './expenses.schemas.js';

const expenseInclude = {
  branch: { select: { id: true, name: true } },
  payments: { select: { id: true, amount: true, paidAt: true, reason: true } },
} satisfies Prisma.MerchantExpenseInclude;

const defaultCategories = ['Rent', 'Utilities', 'Supplies', 'Maintenance', 'Transport', 'Other'];

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PrivateMediaStorage) private readonly storage: PrivateMediaStorage,
  ) {}

  async list(
    merchantId: string,
    input: unknown,
  ): Promise<{ items: MerchantExpenseSummary[]; nextCursor: string | null }> {
    const query = parseRequest(listExpensesSchema, input);
    const monthStart = monthStartDate(query.month);
    const monthEnd = nextMonth(monthStart);
    if (query.cursor) {
      const anchor = await this.prisma.merchantExpense.findFirst({
        where: { id: query.cursor, merchantId },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const records = await this.prisma.merchantExpense.findMany({
      where: {
        merchantId,
        incurredOn: { gte: monthStart, lt: monthEnd },
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: expenseInclude,
      orderBy: [{ incurredOn: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit).map(toExpenseSummary);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async categories(merchantId: string): Promise<string[]> {
    const saved = await this.prisma.merchantExpense.findMany({
      where: { merchantId },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
      take: 200,
    });
    return [...new Set([...defaultCategories, ...saved.map((item) => item.category)])].sort(
      (a, b) => a.localeCompare(b),
    );
  }

  async summary(merchantId: string, month: string, branchId?: string): Promise<ExpenseMonthSummary> {
    parseRequest(expenseMonthSchema, { month, ...(branchId ? { branchId } : {}) });
    const start = monthStartDate(month);
    const end = nextMonth(start);
    const [expenses, paid, outstanding] = await Promise.all([
      this.prisma.merchantExpense.aggregate({
        where: { merchantId, incurredOn: { gte: start, lt: end }, ...(branchId ? { branchId } : {}) },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<Array<{ amount: string }>>`
        SELECT COALESCE(SUM(p."amount"),0)::text AS amount
        FROM "expense_payments" p
        JOIN "merchant_expenses" e ON e."id"=p."expenseId" AND e."merchantId"=p."merchantId"
        WHERE p."merchantId"=${merchantId}::uuid
          AND (${branchId ?? null}::uuid IS NULL OR e."branchId"=${branchId ?? null}::uuid)
          AND p."paidAt">=(${month + '-01'}::date::timestamp AT TIME ZONE 'Africa/Cairo')
          AND p."paidAt"<((${month + '-01'}::date+INTERVAL '1 month')::timestamp AT TIME ZONE 'Africa/Cairo')`,
      this.prisma.$queryRaw<Array<{ amount: string }>>`
        SELECT COALESCE(SUM(expense."amount" - COALESCE(paid."amount", 0)), 0)::text AS "amount"
        FROM "merchant_expenses" expense
        LEFT JOIN (
          SELECT "expenseId", SUM("amount") AS "amount"
          FROM "expense_payments"
          WHERE "merchantId" = ${merchantId}::uuid
          GROUP BY "expenseId"
        ) paid ON paid."expenseId" = expense."id"
        WHERE expense."merchantId" = ${merchantId}::uuid
          AND (${branchId ?? null}::uuid IS NULL OR expense."branchId"=${branchId ?? null}::uuid)
          AND expense."incurredOn" >= ${start}
          AND expense."incurredOn" < ${end}`,
    ]);
    return {
      month,
      incurredAmount: expenses._sum.amount?.toFixed(2) ?? '0.00',
      paidDuringMonth: formatCents(toCents(paid[0]?.amount ?? '0.00')),
      outstandingAmount: formatCents(toCents(outstanding[0]?.amount ?? '0.00')),
    };
  }

  async create(merchantId: string, actor: string, input: unknown): Promise<MerchantExpenseSummary> {
    const parsed = parseRequest(createExpenseSchema, input);
    const incurredOn = dateOnly(parsed.incurredOn);
    assertDate(incurredOn, parsed.incurredOn);
    const record = await this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: parsed.branchId, merchantId, archivedAt: null },
        select: { id: true },
      });
      if (!branch) throw new ConflictException('Choose an active branch in this business.');
      return tx.merchantExpense.create({
        data: {
          merchantId,
          branchId: parsed.branchId,
          incurredOn,
          category: parsed.category,
          amount: parsed.amount,
          description: parsed.description,
          createdBy: actor,
          updatedBy: actor,
        },
        include: expenseInclude,
      });
    });
    return toExpenseSummary(record);
  }

  async update(
    merchantId: string,
    actor: string,
    id: string,
    input: unknown,
  ): Promise<MerchantExpenseSummary> {
    const parsed = parseRequest(updateExpenseSchema, input);
    const incurredOn = dateOnly(parsed.incurredOn);
    assertDate(incurredOn, parsed.incurredOn);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.merchantExpense.findFirst({
        where: { id, merchantId },
        include: { payments: { select: { amount: true } } },
      });
      if (!current) throw new NotFoundException('Expense was not found.');
      if (current.revision !== parsed.revision)
        throw new ConflictException('Expense changed since it was loaded. Refresh and try again.');
      if (
        current.payments.length > 0 &&
        (current.branchId !== parsed.branchId ||
          current.incurredOn.toISOString().slice(0, 10) !== parsed.incurredOn ||
          toCents(current.amount.toFixed(2)) !== toCents(parsed.amount))
      )
        throw new ConflictException(
          'Date, branch and amount cannot change after an expense payment is recorded.',
        );
      const branch = await tx.branch.findFirst({
        where: { id: parsed.branchId, merchantId, archivedAt: null },
        select: { id: true },
      });
      if (!branch) throw new ConflictException('Choose an active branch in this business.');
      const changed = await tx.merchantExpense.updateMany({
        where: { id, merchantId, revision: parsed.revision },
        data: {
          branchId: parsed.branchId,
          incurredOn,
          category: parsed.category,
          amount: parsed.amount,
          description: parsed.description,
          revision: { increment: 1 },
          updatedBy: actor,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Expense changed since it was loaded. Refresh and try again.');
      const saved = await tx.merchantExpense.findFirst({
        where: { id, merchantId },
        include: expenseInclude,
      });
      if (!saved) throw new NotFoundException('Expense was not found.');
      return toExpenseSummary(saved);
    });
  }

  async pay(merchantId: string, actor: string, expenseId: string, input: unknown) {
    const parsed = parseRequest(recordExpensePaymentSchema, input);
    const fingerprint = hash({ expenseId, ...parsed });
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const prior = await tx.expensePayment.findUnique({
            where: { merchantId_requestId: { merchantId, requestId: parsed.requestId } },
          });
          if (prior) {
            if (prior.fingerprint !== fingerprint)
              throw new ConflictException(
                'This payment request ID was used with different details.',
              );
            return;
          }
          await tx.$queryRaw`SELECT "id" FROM "merchant_expenses" WHERE "id"=${expenseId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
          const expense = await tx.merchantExpense.findFirst({
            where: { id: expenseId, merchantId },
            include: { payments: { select: { amount: true } } },
          });
          if (!expense) throw new NotFoundException('Expense was not found.');
          const paid = sumAmounts(expense.payments.map((payment) => payment.amount.toFixed(2)));
          const remaining = subtractAmount(expense.amount.toFixed(2), paid);
          if (toCents(parsed.amount) > toCents(remaining))
            throw new ConflictException('The payment exceeds the expense balance.');
          const movement = await recordSafeMovementInTransaction(tx, {
            merchantId,
            branchId: expense.branchId,
            safeId: parsed.safeId,
            requestId: parsed.requestId,
            actor,
            amount: parsed.amount,
            kind: 'withdrawal',
            purpose: 'hr_expense',
            reason: `Expense payment: ${parsed.reason}`,
          });
          await tx.expensePayment.create({
            data: {
              merchantId,
              expenseId,
              requestId: parsed.requestId,
              fingerprint,
              cashMovementId: movement.id,
              amount: parsed.amount,
              reason: parsed.reason,
              createdBy: actor,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new ConflictException(
          'Payment or cash record already exists. Refresh and retry the saved request.',
        );
      throw error;
    }
    const record = await this.prisma.merchantExpense.findFirst({
      where: { id: expenseId, merchantId },
      include: expenseInclude,
    });
    if (!record) throw new NotFoundException('Expense was not found.');
    return toExpenseSummary(record);
  }

  async uploadReceipt(
    merchantId: string,
    actor: string,
    expenseId: string,
    file: { buffer: Buffer; mimeType: string },
  ) {
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensionByType[file.mimeType];
    if (!extension) throw new ConflictException('Receipt must be a JPEG, PNG or WebP image.');
    if (file.buffer.length === 0 || file.buffer.length > 4 * 1024 * 1024)
      throw new ConflictException('Receipt image must be less than 4 MB.');
    if (!hasImageSignature(file.buffer, file.mimeType))
      throw new ConflictException('The uploaded file does not match its image type.');

    const key = `expenses/${merchantId}/${expenseId}/${randomUUID()}.${extension}`;
    await this.storage.write(key, file.buffer);
    let previousKey: string | null = null;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "merchant_expenses" WHERE "id"=${expenseId}::uuid AND "merchantId"=${merchantId}::uuid FOR UPDATE`;
        const expense = await tx.merchantExpense.findFirst({
          where: { id: expenseId, merchantId },
          select: { id: true, receiptStorageKey: true },
        });
        if (!expense) throw new NotFoundException('Expense was not found.');
        previousKey = expense.receiptStorageKey;
        return tx.merchantExpense.update({
          where: { id: expense.id },
          data: {
            receiptStorageKey: key,
            receiptMimeType: file.mimeType,
            receiptSizeBytes: file.buffer.length,
            revision: { increment: 1 },
            updatedBy: actor,
          },
          select: { id: true },
        });
      });
      if (previousKey) await this.storage.remove(previousKey).catch(() => undefined);
      return { id: result.id, receiptAvailable: true as const };
    } catch (error) {
      await this.storage.remove(key).catch(() => undefined);
      throw error;
    }
  }

  async receipt(merchantId: string, expenseId: string) {
    const expense = await this.prisma.merchantExpense.findFirst({
      where: { id: expenseId, merchantId },
      select: { receiptStorageKey: true, receiptMimeType: true },
    });
    if (!expense?.receiptStorageKey || !expense.receiptMimeType)
      throw new NotFoundException('Receipt image was not found.');
    return {
      buffer: await this.storage.read(expense.receiptStorageKey),
      mimeType: expense.receiptMimeType,
    };
  }
}

function toExpenseSummary(expense: {
  id: string;
  branchId: string;
  incurredOn: Date;
  category: string;
  amount: { toFixed: (digits: number) => string };
  description: string;
  revision: number;
  receiptStorageKey: string | null;
  createdAt: Date;
  branch: { id: string; name: string };
  payments: Array<{
    id: string;
    amount: { toFixed: (digits: number) => string };
    paidAt: Date;
    reason: string;
  }>;
}): MerchantExpenseSummary {
  const paidAmount = sumAmounts(expense.payments.map((payment) => payment.amount.toFixed(2)));
  return {
    id: expense.id,
    branchId: expense.branchId,
    branchName: expense.branch.name,
    incurredOn: toDateOnly(expense.incurredOn),
    category: expense.category,
    amount: expense.amount.toFixed(2),
    description: expense.description,
    paidAmount,
    remainingAmount: subtractAmount(expense.amount.toFixed(2), paidAmount),
    revision: expense.revision,
    receiptAvailable: expense.receiptStorageKey !== null,
    createdAt: expense.createdAt.toISOString(),
  };
}

function sumAmounts(values: string[]): string {
  return formatCents(values.reduce((total, value) => total + toCents(value), 0n));
}

function subtractAmount(left: string, right: string): string {
  const value = toCents(left) - toCents(right);
  return formatCents(value < 0n ? 0n : value);
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function assertDate(value: Date, input: string): void {
  if (Number.isNaN(value.getTime()) || toDateOnly(value) !== input)
    throw new ConflictException('Enter a valid calendar date.');
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function nextMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function hasImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg')
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png')
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  return (
    mimeType === 'image/webp' &&
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}
