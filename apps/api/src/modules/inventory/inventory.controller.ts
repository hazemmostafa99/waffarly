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
  CreateStockItemRequest,
  CursorPage,
  OwnerProfile,
  StockItem,
  StockItemConversion,
  StockItemConversionRequest,
  StockItemCostSummary,
  SetStockItemOpeningCostRequest,
  StockItemRevisionRequest,
  UpdateStockItemRequest,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { InventoryService } from './inventory.service.js';
import { InventoryCostService } from './inventory-cost.service.js';
import {
  convertStockItemSchema,
  createStockItemSchema,
  listStockItemsSchema,
  listStockItemCostEventsSchema,
  stockItemRevisionSchema,
  setStockItemOpeningCostSchema,
  updateStockItemSchema,
  type StockItemListQuery,
  type StockItemCostEventsQuery,
} from './inventory.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/inventory/items')
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(InventoryCostService) private readonly costs: InventoryCostService,
  ) {}

  @Get()
  list(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listStockItemsSchema, { format: 'messages' }))
    query: StockItemListQuery,
  ): Promise<CursorPage<StockItem>> {
    return this.inventory.list(owner.merchantId, query);
  }

  @Get(':id')
  get(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<StockItem> {
    return this.inventory.get(owner.merchantId, id);
  }

  @Get(':id/cost')
  getCost(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodValidationPipe(listStockItemCostEventsSchema, { format: 'messages' }))
    query: StockItemCostEventsQuery,
  ): Promise<StockItemCostSummary> {
    return this.costs.getCostSummary(owner.merchantId, id, query);
  }

  @Post(':id/opening-cost')
  setOpeningCost(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(setStockItemOpeningCostSchema, { format: 'messages' }))
    input: SetStockItemOpeningCostRequest,
  ): Promise<StockItemCostSummary> {
    return this.costs.setOpeningCost(owner.merchantId, owner.username, id, input);
  }

  @Post()
  create(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createStockItemSchema, { format: 'messages' }))
    input: CreateStockItemRequest,
  ): Promise<StockItem> {
    return this.inventory.create(owner.merchantId, owner.username, input);
  }

  @Patch(':id')
  update(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateStockItemSchema, { format: 'messages' }))
    input: UpdateStockItemRequest,
  ): Promise<StockItem> {
    return this.inventory.update(owner.merchantId, owner.username, id, input);
  }

  @Post(':id/archive')
  archive(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(stockItemRevisionSchema, { format: 'messages' }))
    input: StockItemRevisionRequest,
  ): Promise<StockItem> {
    return this.inventory.setArchived(owner.merchantId, owner.username, id, true, input);
  }

  @Post(':id/restore')
  restore(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(stockItemRevisionSchema, { format: 'messages' }))
    input: StockItemRevisionRequest,
  ): Promise<StockItem> {
    return this.inventory.setArchived(owner.merchantId, owner.username, id, false, input);
  }

  @Post(':id/convert')
  convert(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(convertStockItemSchema, { format: 'messages' }))
    input: StockItemConversionRequest,
  ): Promise<StockItemConversion> {
    return this.inventory.convert(owner.merchantId, id, input);
  }
}
