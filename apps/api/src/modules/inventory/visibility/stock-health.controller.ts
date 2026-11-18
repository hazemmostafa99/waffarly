/** Receives owner requests for low-stock views and replenishment thresholds. */
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  ClearInventoryReorderThresholdResult,
  InventoryHealthPage,
  InventoryReorderThreshold,
  OwnerProfile,
  UpdateInventoryReorderThresholdRequest,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../../auth/index.js';

import { InventoryVisibilityService } from '../inventory-visibility.service.js';
import {
  listInventoryHealthSchema,
  updateInventoryReorderThresholdSchema,
  deleteInventoryReorderThresholdSchema,
  type InventoryHealthListQuery,
} from '../inventory.schemas.js';
@UseGuards(OwnerGuard)
@Controller('owner/inventory')
export class InventoryHealthController {
  constructor(
    @Inject(InventoryVisibilityService) private readonly visibility: InventoryVisibilityService,
  ) {}
  @Get('health')
  listHealth(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listInventoryHealthSchema, { format: 'messages' }))
    query: InventoryHealthListQuery,
  ): Promise<InventoryHealthPage> {
    return this.visibility.listHealth(owner.merchantId, query);
  }
  @Patch('warehouses/:warehouseId/items/:stockItemId/reorder-threshold')
  saveReorderThreshold(
    @CurrentOwner() owner: OwnerProfile,
    @Param('warehouseId', new ParseUUIDPipe()) warehouseId: string,
    @Param('stockItemId', new ParseUUIDPipe()) stockItemId: string,
    @Body(new ZodValidationPipe(updateInventoryReorderThresholdSchema, { format: 'messages' }))
    input: UpdateInventoryReorderThresholdRequest,
  ): Promise<InventoryReorderThreshold> {
    return this.visibility.saveThreshold(
      owner.merchantId,
      owner.username,
      warehouseId,
      stockItemId,
      input,
    );
  }
  @Delete('warehouses/:warehouseId/items/:stockItemId/reorder-threshold')
  deleteReorderThreshold(
    @CurrentOwner() owner: OwnerProfile,
    @Param('warehouseId', new ParseUUIDPipe()) warehouseId: string,
    @Param('stockItemId', new ParseUUIDPipe()) stockItemId: string,
    @Body(new ZodValidationPipe(deleteInventoryReorderThresholdSchema, { format: 'messages' }))
    input: { revision: number },
  ): Promise<ClearInventoryReorderThresholdResult> {
    return this.visibility.deleteThreshold(owner.merchantId, warehouseId, stockItemId, input);
  }
}
