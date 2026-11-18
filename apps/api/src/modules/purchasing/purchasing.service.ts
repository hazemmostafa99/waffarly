import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ConfirmPurchaseInvoiceRequest,
  ConfirmPurchaseInvoiceResult,
  CreatePurchaseInvoiceRequest,
  CreatePurchaseSupplierCreditNoteRequest,
  CreatePurchaseInvoiceCorrectionRequest,
  CursorPage,
  PurchaseInvoice,
  CreatePurchaseSupplierPaymentRequest,
  PurchaseCashMovementOption,
  PurchaseSupplierPaymentSummary,
  UpdatePurchaseInvoiceRequest,
} from '@waffarly/contracts';
import { calculatePurchaseInvoiceAmounts } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { assertScopedCursor } from '../../common/http/pagination.js';
import { createHash, randomUUID } from 'node:crypto';
import { parseRequest } from '../../common/http/zod-validation.pipe.js';
import { isUniqueConstraintError } from '../../infrastructure/database/prisma-errors.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import {
  InventoryCostService,
  InventoryLedgerService,
  normalizeStockQuantity,
  convertToBaseQuantity,
  parseStockQuantity,
} from '../inventory/index.js';
import {
  confirmPurchaseInvoiceSchema,
  createPurchaseInvoiceSchema,
  listPurchaseInvoicesSchema,
  updatePurchaseInvoiceSchema,
  type PurchaseInvoiceListQuery,
  createPurchaseSupplierPaymentSchema,
  listPurchaseCashMovementsSchema,
  createPurchaseSupplierCreditNoteSchema,
  createPurchaseInvoiceCorrectionSchema,
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
    @Inject(InventoryCostService) private readonly costs: InventoryCostService,
  ) {}

  async listCashMovements(
    merchantId: string,
    input: unknown,
  ): Promise<PurchaseCashMovementOption[]> {
    const query = parseRequest(listPurchaseCashMovementsSchema, input);
    const [safeRows, drawerRows] = await Promise.all([
      this.prisma.posCashSafeMovement.findMany({
        where: {
          merchantId,
          kind: 'withdrawal',
          amount: { lt: 0 },
          ...(query.branchId ? { safe: { branchId: query.branchId } } : {}),
        },
        include: { safe: { select: { branchId: true, branch: { select: { name: true } } } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
      }),
      this.prisma.posShiftManualCashMovement.findMany({
        where: {
          merchantId,
          kind: 'cash_out',
          ...(query.branchId ? { shift: { branchId: query.branchId } } : {}),
        },
        include: {
          shift: { select: { id: true, branchId: true, branch: { select: { name: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
      }),
    ]);
    const [safeSums, drawerSums] = await Promise.all([
      this.prisma.purchaseSupplierPayment.groupBy({
        by: ['safeMovementId'],
        where: { merchantId, safeMovementId: { in: safeRows.map((row) => row.id) } },
        _sum: { amount: true },
      }),
      this.prisma.purchaseSupplierPayment.groupBy({
        by: ['drawerMovementId'],
        where: { merchantId, drawerMovementId: { in: drawerRows.map((row) => row.id) } },
        _sum: { amount: true },
      }),
    ]);
    const safeApplied = new Map(safeSums.map((row) => [row.safeMovementId, row._sum.amount ?? 0]));
    const drawerApplied = new Map(
      drawerSums.map((row) => [row.drawerMovementId, row._sum.amount ?? 0]),
    );
    const events: PurchaseCashMovementOption[] = [];
    for (const movement of safeRows) {
      const movementCents = -moneyToSignedCents(movement.amount.toString());
      const remaining =
        movementCents - moneyToCents(safeApplied.get(movement.id)?.toString() ?? '0');
      if (remaining <= 0n) continue;
      events.push({
        sourceType: 'safe',
        movementId: movement.id,
        shiftId: null,
        branchId: movement.safe.branchId,
        branchName: movement.safe.branch.name,
        reason: movement.reason,
        movementAmount: formatCents(movementCents),
        availableAmount: formatCents(remaining),
        createdAt: movement.createdAt.toISOString(),
      });
    }
    for (const movement of drawerRows) {
      const movementCents = moneyToCents(movement.amount.toString());
      const remaining =
        movementCents - moneyToCents(drawerApplied.get(movement.id)?.toString() ?? '0');
      if (remaining <= 0n) continue;
      events.push({
        sourceType: 'drawer',
        movementId: movement.id,
        shiftId: movement.shift.id,
        branchId: movement.shift.branchId,
        branchName: movement.shift.branch.name,
        reason: movement.reason,
        movementAmount: formatCents(movementCents),
        availableAmount: formatCents(remaining),
        createdAt: movement.createdAt.toISOString(),
      });
    }
    return events
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) ||
          right.movementId.localeCompare(left.movementId),
      )
      .slice(0, query.limit);
  }

  async recordSupplierPayment(
    merchantId: string,
    actor: string,
    invoiceId: string,
    input: CreatePurchaseSupplierPaymentRequest,
  ): Promise<PurchaseSupplierPaymentSummary> {
    const parsed = parseRequest(createPurchaseSupplierPaymentSchema, input);
    const amountCents = moneyToCents(parsed.amount);
    if (amountCents <= 0n || amountCents > 999_999_999_999n)
      throw new BadRequestException('Payment amount is outside the supported range.');
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          invoiceId,
          amount: formatCents(amountCents),
          reason: parsed.reason,
          source: parsed.source,
        }),
      )
      .digest('hex');
    const existing = await this.prisma.purchaseSupplierPayment.findUnique({
      where: { merchantId_requestId: { merchantId, requestId: parsed.requestId } },
    });
    if (existing) return replaySupplierPayment(existing, fingerprint);

    return this.prisma.$transaction(
      async (tx) => {
        await lockInvoice(tx, merchantId, invoiceId);
        const invoice = await tx.purchaseInvoice.findFirst({
          where: { merchantId, id: invoiceId },
          include: { warehouse: { select: { branchId: true } }, payments: true, creditNotes: true, corrections: true },
        });
        if (!invoice) throw new NotFoundException('Purchase invoice was not found.');
        if (invoice.status !== 'confirmed' || invoice.totalAmount === null)
          throw new ConflictException(
            'Supplier payments are only allowed on confirmed priced invoices.',
          );
        const paidCents = invoice.payments.reduce(
          (sum, row) => sum + moneyToCents(row.amount.toString()),
          0n,
        );
        const creditCents = invoice.creditNotes.reduce(
          (sum, row) => sum + moneyToCents(row.amount.toString()),
          0n,
        );
        const correctionCents = invoice.corrections.reduce(
          (sum, row) => sum + moneyToSignedCents(row.amountDelta.toString()),
          0n,
        );
        const dueCents = moneyToCents(invoice.totalAmount.toString()) + correctionCents - paidCents - creditCents;
        if (dueCents <= 0n || amountCents > dueCents)
          throw new ConflictException('The payment exceeds the supplier invoice balance due.');

        let sourceShiftId: string | null = null;
        let safeMovementId: string | null = null;
        let drawerMovementId: string | null = null;
        let movementAmountCents: bigint;
        let paidAt: Date;
        if (parsed.source.sourceType === 'safe') {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "pos_cash_safe_movements"
          WHERE "id" = ${parsed.source.movementId}::uuid AND "merchantId" = ${merchantId}::uuid
          FOR UPDATE`;
          if (locked.length !== 1)
            throw new NotFoundException('Cash safe withdrawal was not found.');
          const movement = await tx.posCashSafeMovement.findFirst({
            where: {
              id: parsed.source.movementId,
              merchantId,
              kind: 'withdrawal',
              purpose: null,
              amount: { lt: 0 },
            },
            include: { safe: { select: { branchId: true } } },
          });
          if (!movement) throw new ConflictException('Choose a recorded cash safe withdrawal.');
          if (movement.safe.branchId !== invoice.warehouse.branchId)
            throw new ConflictException(
              'The cash movement and invoice must belong to the same branch.',
            );
          safeMovementId = movement.id;
          movementAmountCents = -moneyToSignedCents(movement.amount.toString());
          paidAt = movement.createdAt;
        } else {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "pos_shift_manual_cash_movements"
          WHERE "id" = ${parsed.source.movementId}::uuid
            AND "shiftId" = ${parsed.source.shiftId}::uuid
            AND "merchantId" = ${merchantId}::uuid
          FOR UPDATE`;
          if (locked.length !== 1)
            throw new NotFoundException('Register cash withdrawal was not found.');
          const movement = await tx.posShiftManualCashMovement.findFirst({
            where: {
              id: parsed.source.movementId,
              shiftId: parsed.source.shiftId,
              merchantId,
              kind: 'cash_out',
            },
            include: { shift: { select: { branchId: true } } },
          });
          if (!movement) throw new ConflictException('Choose a recorded register cash outflow.');
          if (movement.shift.branchId !== invoice.warehouse.branchId)
            throw new ConflictException(
              'The cash movement and invoice must belong to the same branch.',
            );
          drawerMovementId = movement.id;
          sourceShiftId = movement.shiftId;
          movementAmountCents = moneyToCents(movement.amount.toString());
          paidAt = movement.createdAt;
        }
        const priorApplied = await tx.purchaseSupplierPayment.aggregate({
          where: {
            merchantId,
            ...(safeMovementId
              ? { safeMovementId }
              : { drawerMovementId, drawerShiftId: sourceShiftId }),
          },
          _sum: { amount: true },
        });
        if (
          moneyToCents(priorApplied._sum.amount?.toString() ?? '0') + amountCents >
          movementAmountCents
        )
          throw new ConflictException(
            'This cash movement does not have enough unallocated amount.',
          );

        const payment = await tx.purchaseSupplierPayment.create({
          data: {
            merchantId,
            invoiceId,
            requestId: parsed.requestId,
            fingerprint,
            amount: formatCents(amountCents),
            paidAt,
            reason: parsed.reason,
            createdBy: actor,
            safeMovementId,
            drawerMovementId,
            drawerShiftId: sourceShiftId,
          },
        });
        return toSupplierPayment(payment);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async createSupplierCreditNote(
    merchantId: string,
    actor: string,
    invoiceId: string,
    input: CreatePurchaseSupplierCreditNoteRequest,
  ): Promise<PurchaseInvoice> {
    const parsed = parseRequest(createPurchaseSupplierCreditNoteSchema, input);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ invoiceId, ...parsed }))
      .digest('hex');
    await this.prisma.$transaction(async (tx) => {
      await lockInvoice(tx, merchantId, invoiceId);
      const previous = await tx.purchaseSupplierCreditNote.findUnique({
        where: { merchantId_requestId: { merchantId, requestId: parsed.requestId } },
      });
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ConflictException('This supplier credit note request ID was used with different details.');
        return;
      }
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { id: invoiceId, merchantId },
        include: {
          lines: { include: { stockItem: { include: { units: true } } } },
          warehouse: { select: { id: true } },
        },
      });
      if (!invoice) throw new NotFoundException('Purchase invoice was not found.');
      if (invoice.status !== 'confirmed' || invoice.totalAmount === null)
        throw new ConflictException('Supplier credit notes require a confirmed priced invoice.');
      const lineById = new Map(invoice.lines.map((line) => [line.id, line]));
      const lineIds = parsed.lines.map((line) => line.invoiceLineId);
      if (lineIds.some((id) => !lineById.has(id)))
        throw new NotFoundException('A credit note line does not belong to this invoice.');
      const creditCents = parsed.lines.reduce((sum, line) => sum + moneyToCents(line.creditAmount), 0n);
      if (creditCents !== moneyToCents(parsed.amount))
        throw new BadRequestException('The line credits must add up to the supplier credit note amount.');
      const existingReturns = await tx.purchaseSupplierCreditNoteLine.findMany({
        where: { merchantId, invoiceLineId: { in: lineIds } },
        select: { invoiceLineId: true, quantity: true },
      });
      const returnedByLine = new Map<string, bigint>();
      for (const row of existingReturns) {
        returnedByLine.set(
          row.invoiceLineId,
          (returnedByLine.get(row.invoiceLineId) ?? 0n) + parseStockQuantity(row.quantity.toFixed(6)),
        );
      }
      const creditId = randomUUID();
      const issuedAt = new Date();
      const creditNumber = `CRN-${creditId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      const movementLines = parsed.lines.map((requested) => {
        const line = lineById.get(requested.invoiceLineId)!;
        if (line.unitCost === null)
          throw new ConflictException('An old invoice line with unknown cost cannot be returned here.');
        const already = returnedByLine.get(line.id) ?? 0n;
        const quantityScaled = parseStockQuantity(requested.quantity);
        if (already + quantityScaled > parseStockQuantity(line.quantity.toFixed(6)))
          throw new ConflictException('The supplier return exceeds the quantity received on this invoice line.');
        const baseDelta = convertToBaseQuantity(
          requested.quantity,
          line.unitCode,
          line.stockItem.baseUnit as Parameters<typeof convertToBaseQuantity>[2],
          line.stockItem.units.map((unit) => ({ code: unit.code, name: unit.name, baseQuantity: unit.baseQuantity.toFixed(6) })),
        );
        return {
          movement: {
            warehouseId: invoice.warehouseId,
            stockItemId: line.stockItemId,
            condition: line.condition as 'available' | 'non_sellable',
            unitCode: line.unitCode,
            enteredQuantity: normalizeStockQuantity(requested.quantity),
            baseDelta: `-${baseDelta}`,
          },
          line,
          requested,
        };
      });
      const snapshot = {
        fingerprint,
        creditNumber,
        amount: formatCents(creditCents),
        lines: movementLines.map(({ line, requested }) => ({
          invoiceLineId: line.id,
          stockItemId: line.stockItemId,
          stockItemName: line.stockItemName,
          quantity: normalizeStockQuantity(requested.quantity),
          creditAmount: formatCents(moneyToCents(requested.creditAmount)),
        })),
      };
      await tx.purchaseSupplierCreditNote.create({
        data: {
          id: creditId,
          merchantId,
          invoiceId,
          requestId: parsed.requestId,
          fingerprint,
          creditNumber,
          reason: parsed.reason,
          amount: formatCents(creditCents),
          createdBy: actor,
          issuedAt,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          lines: {
            create: movementLines.map(({ line, requested }) => ({
              merchantId,
              invoiceLineId: line.id,
              stockItemId: line.stockItemId,
              stockItemName: line.stockItemName,
              condition: line.condition,
              unitCode: line.unitCode,
              unitName: line.unitName,
              quantity: normalizeStockQuantity(requested.quantity),
              creditAmount: formatCents(moneyToCents(requested.creditAmount)),
            })),
          },
        },
      });
      await this.ledger.postMovementBatch(tx, merchantId, actor, {
        requestId: parsed.requestId,
        sourceType: 'purchase_supplier_return',
        sourceId: creditId,
        kind: 'purchase_return',
        reason: `Supplier return ${creditNumber}: ${parsed.reason}`.slice(0, 500),
        movements: movementLines.map((line) => line.movement),
      });
    }, { isolationLevel: 'Serializable' });
    return this.getInvoice(merchantId, invoiceId);
  }

  async correctPurchaseInvoice(
    merchantId: string,
    actor: string,
    invoiceId: string,
    input: CreatePurchaseInvoiceCorrectionRequest,
  ): Promise<PurchaseInvoice> {
    const parsed = parseRequest(createPurchaseInvoiceCorrectionSchema, input);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ invoiceId, ...parsed }))
      .digest('hex');
    await this.prisma.$transaction(async (tx) => {
      await lockInvoice(tx, merchantId, invoiceId);
      const previous = await tx.purchaseInvoiceCorrection.findUnique({
        where: { merchantId_requestId: { merchantId, requestId: parsed.requestId } },
      });
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new ConflictException('This purchase correction request ID was used with different details.');
        return;
      }
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { id: invoiceId, merchantId },
        include: {
          lines: { include: { stockItem: { include: { units: true } } } },
          corrections: { include: { lines: true }, orderBy: { issuedAt: 'asc' } },
        },
      });
      if (!invoice) throw new NotFoundException('Purchase invoice was not found.');
      if (invoice.status !== 'confirmed' || invoice.totalAmount === null)
        throw new ConflictException('Only a confirmed priced invoice can be corrected.');
      if (invoice.lines.some((line) => line.unitCost === null))
        throw new ConflictException('An invoice with unknown historical line costs cannot be corrected.');
      const lineById = new Map(invoice.lines.map((line) => [line.id, line]));
      const currentCosts = new Map<string, string>(invoice.lines.map((line) => [line.id, line.unitCost!.toFixed(2)]));
      for (const correction of invoice.corrections) {
        for (const line of correction.lines) currentCosts.set(line.invoiceLineId, line.correctedUnitCost.toFixed(2));
      }
      for (const requested of parsed.lines) {
        if (!lineById.has(requested.invoiceLineId))
          throw new NotFoundException('A corrected line does not belong to this invoice.');
      }
      if (parsed.lines.every((line) => currentCosts.get(line.invoiceLineId) === line.unitCost))
        throw new BadRequestException('Enter at least one changed unit cost.');
      const correctedCosts = new Map(currentCosts);
      for (const line of parsed.lines) correctedCosts.set(line.invoiceLineId, line.unitCost);
      const recalculated = calculatePurchaseInvoiceAmounts(
        invoice.lines.map((line) => ({ quantity: normalizeStockQuantity(line.quantity.toFixed(6)), unitCost: correctedCosts.get(line.id)! })),
        invoice.discountAmount?.toFixed(2) ?? '0.00',
        invoice.shippingAmount?.toFixed(2) ?? '0.00',
      );
      if (!recalculated) throw new ConflictException('Corrected invoice totals are outside the supported range.');
      const priorDelta = invoice.corrections.reduce((sum, correction) => sum + moneyToSignedCents(correction.amountDelta.toString()), 0n);
      const previousTotal = moneyToCents(invoice.totalAmount.toString()) + priorDelta;
      const correctedTotal = moneyToCents(recalculated.totalAmount);
      const delta = correctedTotal - previousTotal;
      if (delta === 0n) throw new BadRequestException('This correction does not change the invoice total.');

      const correctionId = randomUUID();
      const issuedAt = new Date();
      const snapshot = {
        fingerprint,
        previousTotal: formatCents(previousTotal),
        correctedTotal: recalculated.totalAmount,
        amountDelta: formatCents(delta),
        lines: invoice.lines.map((line, position) => ({
          invoiceLineId: line.id,
          unitCost: correctedCosts.get(line.id),
          lineTotal: recalculated.lines[position]?.lineTotal,
          discountAllocation: recalculated.lines[position]?.discountAllocation,
          shippingAllocation: recalculated.lines[position]?.shippingAllocation,
        })),
      };
      await tx.purchaseInvoiceCorrection.create({
        data: {
          id: correctionId,
          merchantId,
          invoiceId,
          requestId: parsed.requestId,
          fingerprint,
          amountDelta: formatCents(delta),
          reason: parsed.reason,
          createdBy: actor,
          issuedAt,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          lines: {
            create: parsed.lines.map((requested) => {
              const line = lineById.get(requested.invoiceLineId)!;
              return {
                merchantId,
                invoiceLineId: line.id,
                stockItemId: line.stockItemId,
                originalUnitCost: currentCosts.get(line.id)!,
                correctedUnitCost: requested.unitCost,
              };
            }),
          },
        },
      });
      const costLines = invoice.lines.map((line, position) => {
        const item = line.stockItem;
        return {
          stockItemId: line.stockItemId,
          condition: line.condition,
          quantity: normalizeStockQuantity(line.quantity.toFixed(6)),
          baseQuantity: convertToBaseQuantity(
            normalizeStockQuantity(line.quantity.toFixed(6)),
            line.unitCode,
            item.baseUnit as Parameters<typeof convertToBaseQuantity>[2],
            item.units.map((unit) => ({ code: unit.code, name: unit.name, baseQuantity: unit.baseQuantity.toFixed(6) })),
          ),
          unitCode: line.unitCode,
          unitName: line.unitName,
          unitCost: correctedCosts.get(line.id)!,
          discountAllocation: recalculated.lines[position]!.discountAllocation,
          shippingAllocation: recalculated.lines[position]!.shippingAllocation,
          lineTotal: recalculated.lines[position]!.lineTotal,
          position,
        };
      });
      await this.costs.recordPurchaseInvoiceCorrection(
        tx,
        merchantId,
        actor,
        parsed.requestId,
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.supplierInvoiceNumber,
          supplierName: invoice.supplierName,
          warehouseId: invoice.warehouseId,
          warehouseName: invoice.warehouseName,
        },
        costLines,
      );
    }, { isolationLevel: 'Serializable' });
    return this.getInvoice(merchantId, invoiceId);
  }

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
              invoiceDate: refs.invoiceDate,
              notes: refs.notes,
              discountType: refs.discountType,
              discountValue: refs.discountValue,
              warehouseId: refs.warehouse.id,
              warehouseName: refs.warehouse.name,
              branchName: refs.warehouse.branch.name,
              subtotalAmount: refs.subtotalAmount,
              discountAmount: refs.discountAmount,
              shippingAmount: refs.shippingAmount,
              totalAmount: refs.totalAmount,
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
            invoiceDate: refs.invoiceDate,
            notes: refs.notes,
            discountType: refs.discountType,
            discountValue: refs.discountValue,
            warehouseId: refs.warehouse.id,
            warehouseName: refs.warehouse.name,
            branchName: refs.warehouse.branch.name,
            subtotalAmount: refs.subtotalAmount,
            discountAmount: refs.discountAmount,
            shippingAmount: refs.shippingAmount,
            totalAmount: refs.totalAmount,
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
      if (
        current.status === 'draft' &&
        current.lines.some((line) => line.unitCost === null || line.lineTotal === null)
      ) {
        throw new ConflictException(
          'Add a unit cost to every line before confirming this invoice.',
        );
      }

      const refs = await resolveReceiptReferences(transaction, merchantId, current);
      if (current.status === 'draft') {
        await this.costs.recordPurchaseConfirmation(transaction, merchantId, actor, {
          requestId: parsed.requestId,
          invoiceId: current.id,
          invoiceNumber: current.supplierInvoiceNumber,
          supplierName: refs.supplierName,
          warehouseId: current.warehouseId,
          warehouseName: refs.warehouseName,
          lines: current.lines.map((line) => ({
            stockItemId: line.stockItemId,
            condition: line.condition,
            quantity: line.quantity.toFixed(6),
            baseQuantity: refs.baseDeltas.get(line.id)!,
            unitCode: line.unitCode,
            unitName: line.unitName,
            unitCost: line.unitCost?.toFixed(2) ?? '0.00',
            discountAllocation: line.discountAllocation?.toFixed(2) ?? '0.00',
            shippingAllocation: line.shippingAllocation?.toFixed(2) ?? '0.00',
            lineTotal: line.lineTotal?.toFixed(2) ?? '0.00',
            position: line.position,
          })),
        });
      }
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

function moneyToCents(value: string): bigint {
  const [whole, fraction = '00'] = value.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function moneyToSignedCents(value: string): bigint {
  return value.startsWith('-') ? -moneyToCents(value.slice(1)) : moneyToCents(value);
}

function formatCents(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

function replaySupplierPayment(
  payment: {
    id: string;
    amount: { toString(): string };
    paidAt: Date;
    reason: string;
    fingerprint: string;
    safeMovementId: string | null;
    drawerMovementId: string | null;
  },
  fingerprint: string,
): PurchaseSupplierPaymentSummary {
  if (payment.fingerprint !== fingerprint)
    throw new ConflictException('This payment request ID was already used with different details.');
  return toSupplierPayment(payment);
}

function toSupplierPayment(payment: {
  id: string;
  amount: { toString(): string };
  paidAt: Date;
  reason: string;
  safeMovementId: string | null;
  drawerMovementId: string | null;
}): PurchaseSupplierPaymentSummary {
  const sourceMovementId = payment.safeMovementId ?? payment.drawerMovementId;
  if (!sourceMovementId)
    throw new ConflictException('Supplier payment has no recorded cash source.');
  return {
    id: payment.id,
    amount: formatCents(moneyToCents(payment.amount.toString())),
    paidAt: payment.paidAt.toISOString(),
    reason: payment.reason,
    sourceType: payment.safeMovementId ? 'safe' : 'drawer',
    sourceMovementId,
  };
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
