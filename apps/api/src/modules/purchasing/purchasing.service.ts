import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConfirmPurchaseInvoiceRequest,
  ConfirmPurchaseInvoiceResult,
  CreatePurchaseInvoiceRequest,
  CursorPage,
  PurchaseInvoice,
  UpdatePurchaseInvoiceRequest,
} from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { InventoryLedgerService, normalizeStockQuantity } from '../inventory/index.js';
import {
  confirmPurchaseInvoiceSchema,
  createPurchaseInvoiceSchema,
  listPurchaseInvoicesSchema,
  updatePurchaseInvoiceSchema,
  type PurchaseInvoiceListQuery,
} from './purchasing.schemas.js';

import { invoiceInclude, toInvoice, type InvoiceRecord } from './purchase-invoice.mapper.js';
import { assertDraftRevision, invoiceFingerprint } from './purchase-invoice.rules.js';
import {
  lockInvoice,
  resolveInvoiceReferences,
  resolveReceiptReferences,
} from './persistence/purchase-invoice.persistence.js';

@Injectable()
export class PurchasingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
  ) {}

  async listInvoices(
    merchantId: string,
    input: PurchaseInvoiceListQuery,
  ): Promise<CursorPage<PurchaseInvoice>> {
    const query = parseRequest(listPurchaseInvoicesSchema, input);
    const where: Prisma.PurchaseInvoiceWhereInput = {
      merchantId,
      ...(query.status === 'all' ? {} : { status: query.status }),
      ...(query.search
        ? {
            OR: [
              { supplierName: { contains: query.search, mode: 'insensitive' } },
              { supplierInvoiceNumber: { contains: query.search, mode: 'insensitive' } },
              { warehouseName: { contains: query.search, mode: 'insensitive' } },
              { branchName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    if (query.cursor) {
      const anchor = await this.prisma.purchaseInvoice.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      assertScopedCursor(query.cursor, anchor !== null);
    }
    const rows = await this.prisma.purchaseInvoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, query.limit).map(toInvoice);
    return { items, nextCursor: rows.length > query.limit ? items.at(-1)!.id : null };
  }

  async getInvoice(merchantId: string, id: string): Promise<PurchaseInvoice> {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { merchantId, id },
      include: invoiceInclude,
    });
    if (!invoice) throw new NotFoundException('Purchase invoice was not found.');
    return toInvoice(invoice);
  }

  async createInvoice(
    merchantId: string,
    actor: string,
    input: CreatePurchaseInvoiceRequest,
  ): Promise<PurchaseInvoice> {
    const parsed = parseRequest(createPurchaseInvoiceSchema, input);
    const fingerprint = invoiceFingerprint(parsed);
    const existing = await this.prisma.purchaseInvoice.findUnique({
      where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
      include: invoiceInclude,
    });
    if (existing) return replayInvoice(existing, fingerprint);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const refs = await resolveInvoiceReferences(transaction, merchantId, parsed);
        return toInvoice(
          await transaction.purchaseInvoice.create({
            data: {
              merchantId,
              supplierId: refs.supplier.id,
              supplierName: refs.supplier.name,
              supplierInvoiceNumber: refs.supplierInvoiceNumber,
              supplierInvoiceNumberKey: refs.supplierInvoiceNumberKey,
              warehouseId: refs.warehouse.id,
              warehouseName: refs.warehouse.name,
              branchName: refs.warehouse.branch.name,
              creationRequest: parsed.requestId,
              creationFingerprint: fingerprint,
              createdBy: actor,
              updatedBy: actor,
              lines: { create: refs.lines },
            },
            include: invoiceInclude,
          }),
        );
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const replay = await this.prisma.purchaseInvoice.findUnique({
        where: { merchantId_creationRequest: { merchantId, creationRequest: parsed.requestId } },
        include: invoiceInclude,
      });
      if (replay) return replayInvoice(replay, fingerprint);
      throw new ConflictException(
        'This supplier already has a purchase invoice with that supplier invoice number.',
      );
    }
  }

  async updateInvoice(
    merchantId: string,
    actor: string,
    id: string,
    input: UpdatePurchaseInvoiceRequest,
  ): Promise<PurchaseInvoice> {
    const parsed = parseRequest(updatePurchaseInvoiceSchema, input);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockInvoice(transaction, merchantId, id);
        const current = await transaction.purchaseInvoice.findFirst({
          where: { merchantId, id },
          include: invoiceInclude,
        });
        if (!current) throw new NotFoundException('Purchase invoice was not found.');
        assertDraftRevision(current, parsed.revision);
        const refs = await resolveInvoiceReferences(transaction, merchantId, parsed);
        await transaction.purchaseInvoice.update({
          where: { id },
          data: {
            supplierId: refs.supplier.id,
            supplierName: refs.supplier.name,
            supplierInvoiceNumber: refs.supplierInvoiceNumber,
            supplierInvoiceNumberKey: refs.supplierInvoiceNumberKey,
            warehouseId: refs.warehouse.id,
            warehouseName: refs.warehouse.name,
            branchName: refs.warehouse.branch.name,
            updatedBy: actor,
            revision: { increment: 1 },
            lines: {
              deleteMany: {},
              create: refs.lines,
            },
          },
        });
        return toInvoice(
          await transaction.purchaseInvoice.findFirstOrThrow({
            where: { merchantId, id },
            include: invoiceInclude,
          }),
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'This supplier already has a purchase invoice with that supplier invoice number.',
        );
      }
      throw error;
    }
  }

  async confirmInvoice(
    merchantId: string,
    actor: string,
    id: string,
    input: ConfirmPurchaseInvoiceRequest,
  ): Promise<ConfirmPurchaseInvoiceResult> {
    const parsed = parseRequest(confirmPurchaseInvoiceSchema, input);
    return this.prisma.$transaction(async (transaction) => {
      await lockInvoice(transaction, merchantId, id);
      const current = await transaction.purchaseInvoice.findFirst({
        where: { merchantId, id },
        include: invoiceInclude,
      });
      if (!current) throw new NotFoundException('Purchase invoice was not found.');
      if (current.status === 'draft') assertDraftRevision(current, parsed.revision);

      const refs = await resolveReceiptReferences(transaction, merchantId, current);
      // Older receipts may retain a draft supplier name. Reuse their immutable reason
      // so retries remain compatible even when the confirmation snapshot was refreshed.
      const previousReceipt =
        current.status === 'confirmed'
          ? await this.ledger.findSourceBatch(transaction, merchantId, 'purchase_invoice', id)
          : null;
      const reason =
        previousReceipt?.reason ??
        purchaseReceiptReason(refs.supplierName, current.supplierInvoiceNumber, id);
      const receipt = await this.ledger.postMovementBatch(transaction, merchantId, actor, {
        requestId: parsed.requestId,
        sourceType: 'purchase_invoice',
        sourceId: current.id,
        kind: 'purchase_receipt',
        reason,
        movements: current.lines.map((line) => ({
          warehouseId: current.warehouseId,
          stockItemId: line.stockItemId,
          condition: line.condition as 'available' | 'non_sellable',
          unitCode: line.unitCode,
          enteredQuantity: normalizeStockQuantity(line.quantity.toFixed(6)),
          baseDelta: refs.baseDeltas.get(line.id)!,
        })),
      });

      if (current.status === 'confirmed') {
        return { invoice: toInvoice(current), receipt };
      }

      for (const line of current.lines) {
        const item = refs.items.get(line.stockItemId)!;
        await transaction.purchaseInvoiceLine.update({
          where: { id: line.id },
          data: {
            stockItemName: item.name,
            baseUnit: item.baseUnit,
          },
        });
      }
      const confirmed = await transaction.purchaseInvoice.update({
        where: { id: current.id },
        data: {
          supplierName: refs.supplierName,
          warehouseName: refs.warehouseName,
          branchName: refs.branchName,
          status: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: actor,
          updatedBy: actor,
          revision: { increment: 1 },
        },
        include: invoiceInclude,
      });
      return { invoice: toInvoice(confirmed), receipt };
    });
  }
}

function replayInvoice(invoice: InvoiceRecord, fingerprint: string): PurchaseInvoice {
  if (invoice.creationFingerprint !== fingerprint) {
    throw new ConflictException(
      'This purchase invoice request ID was used with different details.',
    );
  }
  return toInvoice(invoice);
}

function purchaseReceiptReason(supplierName: string, number: string | null, id: string): string {
  return `Purchase invoice ${number ?? id} from ${supplierName}`.slice(0, 500);
}
