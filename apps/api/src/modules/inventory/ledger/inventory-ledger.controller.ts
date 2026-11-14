/** Receives owner requests for stock balances, movement history and opening stock. */
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateStockOpeningRequest,
  CursorPage,
  OwnerProfile,
  StockBalance,
  StockMovement,
  StockMovementBatchResult,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../auth/index.js';
import { InventoryLedgerService } from '../inventory-ledger.service.js';

import { InventoryVisibilityService } from '../inventory-visibility.service.js';
import {
  listStockBalancesSchema,
  listStockMovementsSchema,
  createStockOpeningSchema,
  type StockBalanceListQuery,
  type StockMovementListQuery,
} from '../inventory.schemas.js';
@UseGuards(OwnerGuard)
@Controller('owner/inventory')
export class InventoryLedgerController {
  constructor(
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
    @Inject(InventoryVisibilityService) private readonly visibility: InventoryVisibilityService,
  ) {}
  @Get('balances')
  listBalances(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listStockBalancesSchema, { format: 'messages' }))
    query: StockBalanceListQuery,
  ): Promise<CursorPage<StockBalance>> {
    return this.ledger.listBalances(owner.merchantId, query);
  }
  @Get('movements')
  listMovements(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listStockMovementsSchema, { format: 'messages' }))
    query: StockMovementListQuery,
  ): Promise<CursorPage<StockMovement>> {
    return this.ledger.listMovements(owner.merchantId, query);
  }
  @Get('movements/:id')
  getMovement(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<StockMovement> {
    return this.visibility.getMovement(owner.merchantId, id);
  }
  @Post('opening-balances')
  createOpening(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createStockOpeningSchema, { format: 'messages' }))
    input: CreateStockOpeningRequest,
  ): Promise<StockMovementBatchResult> {
    return this.ledger.createOpening(owner.merchantId, owner.username, input);
  }
}
