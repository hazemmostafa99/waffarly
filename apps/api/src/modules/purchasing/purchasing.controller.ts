import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  ConfirmPurchaseInvoiceRequest,
  ConfirmPurchaseInvoiceResult,
  CreatePurchaseSupplierPaymentRequest,
  CreatePurchaseSupplierCreditNoteRequest,
  CreatePurchaseInvoiceCorrectionRequest,
  CreatePurchaseInvoiceRequest,
  CreatePurchaseSupplierRequest,
  CursorPage,
  OwnerProfile,
  PurchaseInvoice,
  PurchaseSupplier,
  PurchaseCashMovementOption,
  PurchaseSupplierPaymentSummary,
  PurchaseSupplierRevisionRequest,
  UpdatePurchaseInvoiceRequest,
  UpdatePurchaseSupplierRequest,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { PurchaseSuppliersService } from './purchase-suppliers.service.js';
import { PurchasingService } from './purchasing.service.js';
import {
  confirmPurchaseInvoiceSchema,
  createPurchaseSupplierPaymentSchema,
  createPurchaseSupplierCreditNoteSchema,
  createPurchaseInvoiceCorrectionSchema,
  createPurchaseInvoiceSchema,
  createPurchaseSupplierSchema,
  listPurchaseInvoicesSchema,
  listPurchaseSuppliersSchema,
  purchaseSupplierRevisionSchema,
  updatePurchaseInvoiceSchema,
  updatePurchaseSupplierSchema,
  type PurchaseInvoiceListQuery,
  type PurchaseSupplierListQuery,
  listPurchaseCashMovementsSchema,
} from './purchasing.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/purchasing')
export class PurchasingController {
  constructor(
    @Inject(PurchasingService) private readonly purchasing: PurchasingService,
    @Inject(PurchaseSuppliersService) private readonly suppliers: PurchaseSuppliersService,
  ) {}

  @Get('suppliers')
  listSuppliers(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listPurchaseSuppliersSchema, { format: 'messages' }))
    query: PurchaseSupplierListQuery,
  ): Promise<CursorPage<PurchaseSupplier>> {
    return this.suppliers.list(owner.merchantId, query);
  }

  @Get('suppliers/:id')
  getSupplier(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PurchaseSupplier> {
    return this.suppliers.get(owner.merchantId, id);
  }

  @Post('suppliers')
  createSupplier(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createPurchaseSupplierSchema, { format: 'messages' }))
    input: CreatePurchaseSupplierRequest,
  ): Promise<PurchaseSupplier> {
    return this.suppliers.create(owner.merchantId, owner.username, input);
  }

  @Patch('suppliers/:id')
  updateSupplier(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePurchaseSupplierSchema, { format: 'messages' }))
    input: UpdatePurchaseSupplierRequest,
  ): Promise<PurchaseSupplier> {
    return this.suppliers.update(owner.merchantId, owner.username, id, input);
  }

  @Post('suppliers/:id/archive')
  archiveSupplier(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(purchaseSupplierRevisionSchema, { format: 'messages' }))
    input: PurchaseSupplierRevisionRequest,
  ): Promise<PurchaseSupplier> {
    return this.suppliers.setArchived(owner.merchantId, owner.username, id, true, input);
  }

  @Post('suppliers/:id/restore')
  restoreSupplier(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(purchaseSupplierRevisionSchema, { format: 'messages' }))
    input: PurchaseSupplierRevisionRequest,
  ): Promise<PurchaseSupplier> {
    return this.suppliers.setArchived(owner.merchantId, owner.username, id, false, input);
  }

  @Get('cash-movements')
  listCashMovements(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listPurchaseCashMovementsSchema, { format: 'messages' }))
    query: unknown,
  ): Promise<PurchaseCashMovementOption[]> {
    return this.purchasing.listCashMovements(owner.merchantId, query);
  }

  @Get('invoices')
  listInvoices(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listPurchaseInvoicesSchema, { format: 'messages' }))
    query: PurchaseInvoiceListQuery,
  ): Promise<CursorPage<PurchaseInvoice>> {
    return this.purchasing.listInvoices(owner.merchantId, query);
  }

  @Get('invoices/:id')
  getInvoice(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PurchaseInvoice> {
    return this.purchasing.getInvoice(owner.merchantId, id);
  }

  @Post('invoices')
  createInvoice(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createPurchaseInvoiceSchema, { format: 'messages' }))
    input: CreatePurchaseInvoiceRequest,
  ): Promise<PurchaseInvoice> {
    return this.purchasing.createInvoice(owner.merchantId, owner.username, input);
  }

  @Patch('invoices/:id')
  updateInvoice(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePurchaseInvoiceSchema, { format: 'messages' }))
    input: UpdatePurchaseInvoiceRequest,
  ): Promise<PurchaseInvoice> {
    return this.purchasing.updateInvoice(owner.merchantId, owner.username, id, input);
  }

  @Post('invoices/:id/confirm')
  confirmInvoice(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(confirmPurchaseInvoiceSchema, { format: 'messages' }))
    input: ConfirmPurchaseInvoiceRequest,
  ): Promise<ConfirmPurchaseInvoiceResult> {
    return this.purchasing.confirmInvoice(owner.merchantId, owner.username, id, input);
  }

  @Post('invoices/:id/payments')
  recordSupplierPayment(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(createPurchaseSupplierPaymentSchema, { format: 'messages' }))
    input: CreatePurchaseSupplierPaymentRequest,
  ): Promise<PurchaseSupplierPaymentSummary> {
    return this.purchasing.recordSupplierPayment(owner.merchantId, owner.username, id, input);
  }

  @Post('invoices/:id/credit-notes')
  createSupplierCreditNote(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(createPurchaseSupplierCreditNoteSchema, { format: 'messages' }))
    input: CreatePurchaseSupplierCreditNoteRequest,
  ): Promise<PurchaseInvoice> {
    return this.purchasing.createSupplierCreditNote(owner.merchantId, owner.username, id, input);
  }

  @Post('invoices/:id/corrections')
  correctInvoice(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(createPurchaseInvoiceCorrectionSchema, { format: 'messages' }))
    input: CreatePurchaseInvoiceCorrectionRequest,
  ): Promise<PurchaseInvoice> {
    return this.purchasing.correctPurchaseInvoice(owner.merchantId, owner.username, id, input);
  }
}
