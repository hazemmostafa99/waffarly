import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CursorPage, MerchantCustomer } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createCustomerSchema,
  customerListSchema,
  updateCustomerSchema,
  type CustomerListQuery,
} from './customer.schemas.js';

const fields = {
  id: true,
  name: true,
  phone: true,
  email: true,
  notes: true,
  segment: true,
  firstChannel: true,
  archivedAt: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MerchantCustomerSelect;
type CustomerRecord = Prisma.MerchantCustomerGetPayload<{ select: typeof fields }>;
function toCustomer(row: CustomerRecord): MerchantCustomer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    revision: row.revision,
    segment: row.segment as MerchantCustomer['segment'],
    firstChannel: row.firstChannel as MerchantCustomer['firstChannel'],
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CustomersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(merchantId: string, input: CustomerListQuery): Promise<CursorPage<MerchantCustomer>> {
    const query = parseRequest(customerListSchema, input);
    const where: Prisma.MerchantCustomerWhereInput = {
      merchantId,
      ...(query.status === 'all'
        ? {}
        : { archivedAt: query.status === 'active' ? null : { not: null } }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.merchantCustomer.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const rows = await this.prisma.merchantCustomer.findMany({
      where,
      select: fields,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map(toCustomer);
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  async get(merchantId: string, id: string): Promise<MerchantCustomer> {
    const row = await this.prisma.merchantCustomer.findFirst({
      where: { merchantId, id },
      select: fields,
    });
    if (!row) throw new NotFoundException('Customer was not found.');
    return toCustomer(row);
  }

  async create(merchantId: string, actor: string, input: unknown): Promise<MerchantCustomer> {
    const parsed = parseRequest(createCustomerSchema, input);
    const data = {
      name: parsed.name,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      notes: parsed.notes ?? '',
      segment: parsed.segment ?? 'regular',
    };
    const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const replay = async () => {
      const row = await this.prisma.merchantCustomer.findUnique({
        where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
        select: { ...fields, creationFingerprint: true },
      });
      if (!row) return null;
      if (row.creationFingerprint !== fingerprint)
        throw new ConflictException('Request ID was used for different customer data.');
      // Explicit projection excludes even internal idempotency data.
      return toCustomer(row);
    };
    const previous = await replay();
    if (previous) return previous;
    try {
      return toCustomer(
        await this.prisma.merchantCustomer.create({
          data: {
            ...data,
            merchantId,
            firstChannel: 'manual',
            creationRequest: parsed.requestId,
            creationFingerprint: fingerprint,
            createdBy: actor,
            updatedBy: actor,
          },
          select: fields,
        }),
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const previous = await replay();
      if (previous) return previous;
      throw error;
    }
  }

  async update(
    merchantId: string,
    actor: string,
    id: string,
    input: unknown,
  ): Promise<MerchantCustomer> {
    const { revision, archived, ...data } = parseRequest(updateCustomerSchema, input);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.merchantCustomer.updateMany({
        where: { merchantId, id, revision },
        data: {
          ...(data.name === undefined ? {} : { name: data.name }),
          ...(data.phone === undefined ? {} : { phone: data.phone }),
          ...(data.email === undefined ? {} : { email: data.email }),
          ...(data.notes === undefined ? {} : { notes: data.notes }),
          ...(data.segment === undefined ? {} : { segment: data.segment }),
          ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
          updatedBy: actor,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        if (
          !(await tx.merchantCustomer.findFirst({
            where: { merchantId, id },
            select: { id: true },
          }))
        )
          throw new NotFoundException('Customer was not found.');
        throw new ConflictException('Customer has changed. Refresh and try again.');
      }
      return toCustomer(
        await tx.merchantCustomer.findFirstOrThrow({ where: { merchantId, id }, select: fields }),
      );
    });
  }

  /** Lock on the caller transaction so archival cannot race an order association. */
  async requireActive(merchantId: string, id: string, tx: Prisma.TransactionClient): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "merchant_customers"
      WHERE "merchantId" = ${merchantId}::uuid AND "id" = ${id}::uuid AND "archivedAt" IS NULL
      FOR SHARE
    `;
    if (rows.length !== 1) throw new NotFoundException('Active customer was not found.');
  }
}
