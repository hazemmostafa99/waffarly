import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatePurchaseSupplierRequest,
  CursorPage,
  PurchaseSupplier,
  PurchaseSupplierRevisionRequest,
  UpdatePurchaseSupplierRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { createHash } from 'node:crypto';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  createPurchaseSupplierSchema,
  listPurchaseSuppliersSchema,
  purchaseSupplierRevisionSchema,
  updatePurchaseSupplierSchema,
  type PurchaseSupplierListQuery,
} from './purchasing.schemas.js';

const fields = {
  id: true,
  name: true,
  nameKey: true,
  contactName: true,
  phone: true,
  email: true,
  address: true,
  creationFingerprint: true,
  archivedAt: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PurchaseSupplierSelect;
type SupplierRecord = Prisma.PurchaseSupplierGetPayload<{ select: typeof fields }>;

@Injectable()
export class PurchaseSuppliersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    merchantId: string,
    input: PurchaseSupplierListQuery,
  ): Promise<CursorPage<PurchaseSupplier>> {
    const query = parseRequest(listPurchaseSuppliersSchema, input);
    const where: Prisma.PurchaseSupplierWhereInput = {
      merchantId,
      ...(query.status === 'all'
        ? {}
        : { archivedAt: query.status === 'active' ? null : { not: null } }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.purchaseSupplier.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const rows = await this.prisma.purchaseSupplier.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map(toSupplier);
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  async get(merchantId: string, id: string): Promise<PurchaseSupplier> {
    const supplier = await this.prisma.purchaseSupplier.findFirst({
      where: { merchantId, id },
      select: fields,
    });
    if (!supplier) throw new NotFoundException('Supplier was not found.');
    return toSupplier(supplier);
  }

  async create(
    merchantId: string,
    actor: string,
    input: CreatePurchaseSupplierRequest,
  ): Promise<PurchaseSupplier> {
    const parsed = parseRequest(createPurchaseSupplierSchema, input);
    const data = supplierFields(parsed);
    const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const existing = await this.prisma.purchaseSupplier.findUnique({
      where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
      select: fields,
    });
    if (existing) return replaySupplier(existing, fingerprint);
    try {
      return toSupplier(
        await this.prisma.purchaseSupplier.create({
          data: {
            merchantId,
            ...data,
            creationRequest: parsed.requestId,
            creationFingerprint: fingerprint,
            createdBy: actor,
            updatedBy: actor,
          },
        }),
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const replay = await this.prisma.purchaseSupplier.findUnique({
        where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
        select: fields,
      });
      if (replay) return replaySupplier(replay, fingerprint);
      throw new ConflictException('A supplier with this name already exists.');
    }
  }

  async update(
    merchantId: string,
    actor: string,
    id: string,
    input: UpdatePurchaseSupplierRequest,
  ): Promise<PurchaseSupplier> {
    const parsed = parseRequest(updatePurchaseSupplierSchema, input);
    const data = supplierFields(parsed);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockSupplier(transaction, merchantId, id);
        const changed = await transaction.purchaseSupplier.updateMany({
          where: { id, merchantId, revision: parsed.revision, archivedAt: null },
          data: { ...data, updatedBy: actor, revision: { increment: 1 } },
        });
        if (changed.count !== 1) await assertSupplierMutable(transaction, merchantId, id);
        return toSupplier(
          await transaction.purchaseSupplier.findFirstOrThrow({
            where: { id, merchantId },
            select: fields,
          }),
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A supplier with this name already exists.');
      }
      throw error;
    }
  }

  async setArchived(
    merchantId: string,
    actor: string,
    id: string,
    archived: boolean,
    input: PurchaseSupplierRevisionRequest,
  ): Promise<PurchaseSupplier> {
    const parsed = parseRequest(purchaseSupplierRevisionSchema, input);
    return this.prisma.$transaction(async (transaction) => {
      await lockSupplier(transaction, merchantId, id);
      const supplier = await transaction.purchaseSupplier.findFirst({ where: { id, merchantId } });
      if (!supplier) throw new NotFoundException('Supplier was not found.');
      if (supplier.revision !== parsed.revision) {
        throw new ConflictException('Supplier was changed by another request.');
      }
      if (archived) {
        const draftCount = await transaction.purchaseInvoice.count({
          where: { merchantId, supplierId: id, status: 'draft' },
        });
        if (draftCount > 0) {
          throw new ConflictException(
            'A supplier with draft purchase invoices cannot be archived.',
          );
        }
      }
      return toSupplier(
        await transaction.purchaseSupplier.update({
          where: { id },
          data: {
            archivedAt: archived ? new Date() : null,
            updatedBy: actor,
            revision: { increment: 1 },
          },
          select: fields,
        }),
      );
    });
  }
}

function supplierFields(input: CreatePurchaseSupplierRequest | UpdatePurchaseSupplierRequest) {
  const name = input.name.trim();
  return {
    name,
    nameKey: name.toLocaleLowerCase('en-US'),
    contactName: optionalValue(input.contactName),
    phone: optionalValue(input.phone),
    email: optionalValue(input.email)?.toLowerCase() ?? null,
    address: optionalValue(input.address),
  };
}

function optionalValue(value: string | undefined): string | null {
  return value?.trim() || null;
}

async function lockSupplier(transaction: Prisma.TransactionClient, merchantId: string, id: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "purchase_suppliers"
    WHERE "id" = ${id}::uuid AND "merchantId" = ${merchantId}::uuid
    FOR UPDATE`;
  if (rows.length !== 1) throw new NotFoundException('Supplier was not found.');
}

async function assertSupplierMutable(
  transaction: Prisma.TransactionClient,
  merchantId: string,
  id: string,
): Promise<never> {
  const supplier = await transaction.purchaseSupplier.findFirst({
    where: { id, merchantId },
    select: { archivedAt: true },
  });
  if (!supplier) throw new NotFoundException('Supplier was not found.');
  if (supplier.archivedAt) throw new ConflictException('Archived suppliers cannot be edited.');
  throw new ConflictException('Supplier was changed by another request.');
}

function replaySupplier(supplier: SupplierRecord, fingerprint: string): PurchaseSupplier {
  if (supplier.creationFingerprint !== fingerprint) {
    throw new ConflictException('This supplier request ID was used with different details.');
  }
  return toSupplier(supplier);
}

function toSupplier(record: SupplierRecord): PurchaseSupplier {
  return {
    id: record.id,
    name: record.name,
    contactName: record.contactName,
    phone: record.phone,
    email: record.email,
    address: record.address,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
