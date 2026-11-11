import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MerchantDiscount, MerchantDiscountStats } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { createDiscountSchema, discountInputSchema, discountListSchema, updateDiscountSchema, type DiscountInput } from './discount.schemas.js';

const fields = { id: true, merchantId: true, name: true, description: true, code: true, type: true, value: true, minimum: true, maximum: true, startDate: true, endDate: true, usageLimit: true, usedCount: true, terms: true, state: true, revision: true, createdAt: true, updatedAt: true, branches: { select: { branchId: true } } } satisfies Prisma.MerchantDiscountSelect;
type DiscountRow = Prisma.MerchantDiscountGetPayload<{ select: typeof fields }>;
function cairoToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}-${parts.find((part) => part.type === 'day')!.value}`;
}
function dateOnly(value: Date) { return value.toISOString().slice(0, 10); }
function statusOf(row: Pick<DiscountRow, 'state' | 'startDate' | 'endDate' | 'usageLimit' | 'usedCount'>, today = cairoToday()): MerchantDiscount['status'] {
  if (row.state === 'draft') return 'draft';
  if (dateOnly(row.endDate) < today || (row.usageLimit !== null && row.usedCount >= row.usageLimit)) return 'expired';
  if (row.state === 'paused') return 'paused';
  return dateOnly(row.startDate) > today ? 'scheduled' : 'active';
}
function toDiscount(row: DiscountRow): MerchantDiscount {
  return { id: row.id, name: row.name, description: row.description, code: row.code, type: row.type as MerchantDiscount['type'], value: row.value.toString(), minimum: row.minimum.toString(), maximum: row.maximum?.toString() ?? '', startDate: dateOnly(row.startDate), endDate: dateOnly(row.endDate), usageLimit: row.usageLimit?.toString() ?? '', branches: row.branches.map(({ branchId }) => branchId), terms: row.terms, state: row.state as MerchantDiscount['state'], revision: row.revision, redemptions: row.usedCount, status: statusOf(row), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function inputData(input: DiscountInput) {
  return { name: input.name, description: input.description, code: input.code, type: input.type, value: input.value, minimum: input.minimum, maximum: input.maximum || null, startDate: new Date(`${input.startDate}T00:00:00Z`), endDate: new Date(`${input.endDate}T00:00:00Z`), usageLimit: input.usageLimit ? Number(input.usageLimit) : null, terms: input.terms, state: input.state };
}

@Injectable()
export class DiscountsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async branches(merchantId: string) {
    return this.prisma.branch.findMany({ where: { merchantId, archivedAt: null }, select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }

  async list(merchantId: string, queryInput: unknown) {
    const query = parseRequest(discountListSchema, queryInput);
    const today = cairoToday();
    const anchor = query.cursor ? await this.prisma.merchantDiscount.findFirst({ where: { id: query.cursor, merchantId }, select: { createdAt: true } }) : null;
    assertScopedCursor(query.cursor, anchor !== null);
    const cursorDate = anchor?.createdAt ?? new Date(0);
    const ids = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT d."id" FROM "merchant_discounts" d
      WHERE d."merchantId" = ${merchantId}::uuid
        AND (${query.search} = '' OR d."name" ILIKE '%' || ${query.search} || '%' OR d."code" ILIKE '%' || ${query.search} || '%')
        AND (${query.type} = 'all' OR d."type" = ${query.type})
        AND (${query.status} = 'all'
          OR (${query.status} = 'draft' AND d."state" = 'draft')
          OR (${query.status} = 'paused' AND d."state" = 'paused' AND d."endDate" >= ${today}::date AND (d."usageLimit" IS NULL OR d."usedCount" < d."usageLimit"))
          OR (${query.status} = 'scheduled' AND d."state" = 'published' AND d."startDate" > ${today}::date AND d."endDate" >= ${today}::date AND (d."usageLimit" IS NULL OR d."usedCount" < d."usageLimit"))
          OR (${query.status} = 'active' AND d."state" = 'published' AND d."startDate" <= ${today}::date AND d."endDate" >= ${today}::date AND (d."usageLimit" IS NULL OR d."usedCount" < d."usageLimit"))
          OR (${query.status} = 'expired' AND d."state" != 'draft' AND (d."endDate" < ${today}::date OR (d."usageLimit" IS NOT NULL AND d."usedCount" >= d."usageLimit"))))
        AND (${query.cursor ?? null}::uuid IS NULL OR (d."createdAt", d."id") < (${cursorDate}, ${query.cursor ?? '00000000-0000-4000-8000-000000000000'}::uuid))
      ORDER BY d."createdAt" DESC, d."id" DESC LIMIT ${query.limit + 1}`;
    const rows = await this.prisma.merchantDiscount.findMany({ where: { merchantId, id: { in: ids.map(({ id }) => id) } }, select: fields });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const pageRows = ids.slice(0, query.limit).flatMap(({ id }) => byId.has(id) ? [byId.get(id)!] : []);
    return { items: pageRows.map(toDiscount), nextCursor: ids.length > query.limit ? pageRows.at(-1)?.id ?? null : null };
  }

  async get(merchantId: string, id: string) {
    const row = await this.prisma.merchantDiscount.findFirst({ where: { merchantId, id }, select: fields });
    if (!row) throw new NotFoundException('Discount was not found.');
    return toDiscount(row);
  }

  async create(merchantId: string, actor: string, input: unknown) {
    const { requestId, ...raw } = parseRequest(createDiscountSchema, input);
    const data = parseRequest(discountInputSchema, raw);
    const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const replay = async () => {
      const existing = await this.prisma.merchantDiscount.findUnique({ where: { merchantId_creationRequest: { merchantId, creationRequest: requestId } }, select: { ...fields, creationFingerprint: true } });
      if (!existing) return null;
      if (existing.creationFingerprint !== fingerprint) throw new ConflictException('Request ID was used for different discount data.');
      return toDiscount(existing);
    };
    const previous = await replay();
    if (previous) return previous;
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await this.requireActiveBranches(merchantId, data.branches, tx);
        return tx.merchantDiscount.create({ data: { ...inputData(data), merchantId, creationRequest: requestId, creationFingerprint: fingerprint, createdBy: actor, updatedBy: actor, branches: { create: data.branches.map((branchId) => ({ merchantId, branchId })) } }, select: fields });
      });
      return toDiscount(row);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const saved = await replay();
      if (saved) return saved;
      throw new ConflictException('A discount with this code already exists.');
    }
  }

  async update(merchantId: string, actor: string, id: string, input: unknown) {
    const { revision, ...raw } = parseRequest(updateDiscountSchema, input);
    const data = parseRequest(discountInputSchema, raw);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await this.requireActiveBranches(merchantId, data.branches, tx);
        const current = await tx.merchantDiscount.findFirst({ where: { merchantId, id }, select: { usedCount: true } });
        if (!current) throw new NotFoundException('Discount was not found.');
        if (data.usageLimit && Number(data.usageLimit) < current.usedCount) throw new BadRequestException('Usage limit cannot be lower than existing redemptions.');
        const saved = await tx.merchantDiscount.updateMany({ where: { id, merchantId, revision }, data: { ...inputData(data), updatedBy: actor, revision: { increment: 1 } } });
        if (!saved.count) {
          throw new ConflictException('Discount has changed. Refresh and try again.');
        }
        await tx.merchantDiscountBranch.deleteMany({ where: { merchantId, discountId: id } });
        if (data.branches.length) await tx.merchantDiscountBranch.createMany({ data: data.branches.map((branchId) => ({ merchantId, discountId: id, branchId })) });
        return tx.merchantDiscount.findFirstOrThrow({ where: { merchantId, id }, select: fields });
      });
      return toDiscount(row);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new ConflictException('A discount with this code already exists.');
      throw error;
    }
  }

  async stats(merchantId: string): Promise<MerchantDiscountStats> {
    const today = cairoToday();
    const [aggregate] = await this.prisma.$queryRaw<Array<{ value: string | null; customers: bigint; redemptions: bigint; active: bigint; coupons: bigint }>>`
      SELECT COALESCE(SUM(r."amount"),0)::text AS "value",
        COUNT(DISTINCT NULLIF(o."customerPhone",'')) AS "customers", COUNT(r."id") AS "redemptions",
        COUNT(DISTINCT d."id") FILTER (WHERE d."state"='published' AND d."startDate" <= ${today}::date AND d."endDate" >= ${today}::date AND (d."usageLimit" IS NULL OR d."usedCount" < d."usageLimit")) AS "active",
        (SELECT COUNT(*) FROM "merchant_discounts" x WHERE x."merchantId"=${merchantId}::uuid) AS "coupons"
      FROM "merchant_discounts" d LEFT JOIN "merchant_discount_redemptions" r ON r."discountId"=d."id" AND r."merchantId"=d."merchantId"
      LEFT JOIN "storefront_orders" o ON o."id"=r."orderId" AND o."merchantId"=r."merchantId"
      WHERE d."merchantId"=${merchantId}::uuid`;
    return { totalDiscountValue: aggregate?.value ?? '0.00', customersReached: Number(aggregate?.customers ?? 0), totalRedemptions: Number(aggregate?.redemptions ?? 0), activeCoupons: Number(aggregate?.active ?? 0), totalCoupons: Number(aggregate?.coupons ?? 0) };
  }

  private async requireActiveBranches(merchantId: string, ids: string[], tx: Prisma.TransactionClient) {
    if (!ids.length) return;
    const count = await tx.branch.count({ where: { merchantId, archivedAt: null, id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException('Choose active branches belonging to this merchant.');
  }
}
