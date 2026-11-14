/**
 * Routes cashier order requests to the file responsible for each operation.
 * The actual sale, payment, kitchen and receipt work lives in those dedicated files.
 */
import { Inject, Injectable } from '@nestjs/common';
import type {
  AddPosKitchenItemsResponse,
  CreatePosOrderResponse,
  PosEmployeeSession,
  PosOrderPaymentStateResponse,
  RecordPosCheckRefundResponse,
  PosReceipt,
  PosReceiptHistoryPage,
  RecordPosCheckPaymentResponse,
  PosOrderQuoteResponse,
  StorefrontOrderSummary,
} from '@waffarly/contracts';

import { type CursorPageQuery } from '../../../common/http/pagination.js';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { ProductConsumptionService, ProductPricingService } from '../../catalog/index.js';
import { InventoryLedgerService } from '../../inventory/index.js';
import { ShiftsService } from '../../shifts/index.js';

import { PaymentsService } from '../../payments/index.js';
import { PosDiningService } from '../dining/pos-dining.service.js';

import { quotePosSale, createPosSale } from './create-pos-sale.js';
import { amendKitchenOrder } from '../kitchen/amend-kitchen-order.js';
import { preparePickupCollection } from '../billing/prepare-pickup-collection.js';
import { recordCheckPayment } from '../billing/collect-order-check.js';
import { recordCheckRefund } from '../billing/refund-order-check.js';
import { listActiveSales, getPosSaleDetails, getOrderPaymentState } from './pos-sales-query.js';
import { getCheckReceipt, listReceipts } from '../receipts/order-receipts.js';

@Injectable()
export class PosOrdersService {
  constructor(
    @Inject(PrismaService) readonly prisma: PrismaService,
    @Inject(ProductPricingService) readonly pricing: ProductPricingService,
    @Inject(ProductConsumptionService) readonly consumption: ProductConsumptionService,
    @Inject(InventoryLedgerService) readonly ledger: InventoryLedgerService,
    @Inject(ShiftsService) readonly shifts: ShiftsService,
    @Inject(PosDiningService) readonly dining: PosDiningService,
    @Inject(PaymentsService) readonly payments: PaymentsService,
  ) {}

  async quote(employee: PosEmployeeSession, input: unknown): Promise<PosOrderQuoteResponse> {
    return quotePosSale(this, employee, input);
  }

  async create(employee: PosEmployeeSession, input: unknown): Promise<CreatePosOrderResponse> {
    return createPosSale(this, employee, input);
  }

  async addKitchenItems(
    employee: PosEmployeeSession,
    orderId: string,
    input: unknown,
  ): Promise<AddPosKitchenItemsResponse> {
    return amendKitchenOrder(this, employee, orderId, input);
  }

  async preparePickupCollection(employee: PosEmployeeSession, orderId: string, registerId: string) {
    return preparePickupCollection(this, employee, orderId, registerId);
  }

  async recordCheckPayment(
    employee: PosEmployeeSession,
    orderId: string,
    checkId: string,
    input: unknown,
  ): Promise<RecordPosCheckPaymentResponse> {
    return recordCheckPayment(this, employee, orderId, checkId, input);
  }

  async recordCheckRefund(
    employee: PosEmployeeSession,
    orderId: string,
    checkId: string,
    input: unknown,
    approverEmployeeId?: string,
  ): Promise<RecordPosCheckRefundResponse> {
    return recordCheckRefund(this, employee, orderId, checkId, input, approverEmployeeId);
  }

  async listActiveSales(
    employee: PosEmployeeSession,
    input: CursorPageQuery & {
      branchId: string;
      search?: string | undefined;
      mode: 'active' | 'history';
    },
  ) {
    return listActiveSales(this, employee, input);
  }

  async detail(employee: PosEmployeeSession, orderId: string): Promise<StorefrontOrderSummary> {
    return getPosSaleDetails(this, employee, orderId);
  }

  async paymentState(
    employee: PosEmployeeSession,
    orderId: string,
  ): Promise<PosOrderPaymentStateResponse> {
    return getOrderPaymentState(this, employee, orderId);
  }

  async getCheckReceipt(
    employee: PosEmployeeSession,
    orderId: string,
    checkId: string,
  ): Promise<PosReceipt> {
    return getCheckReceipt(this, employee, orderId, checkId);
  }

  async listReceipts(
    employee: PosEmployeeSession,
    input: CursorPageQuery & { branchId: string },
  ): Promise<PosReceiptHistoryPage> {
    return listReceipts(this, employee, input);
  }
}
