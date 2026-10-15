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
  CreateInventoryBranchRequest,
  CreateInventoryWarehouseRequest,
  CreateStockOpeningRequest,
  CursorPage,
  InventoryBranch,
  InventoryWarehouseSummary,
  InventoryPolicy,
  OwnerProfile,
  StockBalance,
  StockMovement,
  StockMovementBatchResult,
  StockItemRevisionRequest,
  UpdateInventoryBranchRequest,
  UpdateInventoryPolicyRequest,
  UpdateInventoryWarehouseRequest,
} from '@waffarly/contracts';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { CurrentOwner, OwnerGuard } from '../auth/index.js';
import { InventoryLedgerService } from './inventory-ledger.service.js';
import { InventoryLocationsService } from './inventory-locations.service.js';
import {
  createInventoryBranchSchema,
  createInventoryWarehouseSchema,
  inventoryPolicyUpdateSchema,
  listInventoryBranchesSchema,
  listStockBalancesSchema,
  listStockMovementsSchema,
  createStockOpeningSchema,
  setDefaultConsumptionWarehouseSchema,
  stockItemRevisionSchema,
  updateInventoryBranchSchema,
  updateInventoryWarehouseSchema,
  type InventoryBranchListQuery,
  type StockBalanceListQuery,
  type StockMovementListQuery,
} from './inventory.schemas.js';

@UseGuards(OwnerGuard)
@Controller('owner/inventory')
export class InventoryLocationsController {
  constructor(
    @Inject(InventoryLocationsService) private readonly locations: InventoryLocationsService,
    @Inject(InventoryLedgerService) private readonly ledger: InventoryLedgerService,
  ) {}

  @Get('branches')
  listBranches(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listInventoryBranchesSchema, { format: 'messages' }))
    query: InventoryBranchListQuery,
  ): Promise<CursorPage<InventoryBranch>> {
    return this.locations.listBranches(owner.merchantId, query);
  }

  @Get('warehouses')
  listWarehouses(
    @CurrentOwner() owner: OwnerProfile,
    @Query(new ZodValidationPipe(listInventoryBranchesSchema, { format: 'messages' }))
    query: InventoryBranchListQuery,
  ): Promise<CursorPage<InventoryWarehouseSummary>> {
    return this.locations.listWarehouses(owner.merchantId, query);
  }

  @Get('warehouses/:id')
  getWarehouse(
    @CurrentOwner() owner: OwnerProfile,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<InventoryWarehouseSummary> {
    return this.locations.getWarehouse(owner.merchantId, id);
  }

  @Post('branches')
  createBranch(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createInventoryBranchSchema, { format: 'messages' }))
    input: CreateInventoryBranchRequest,
  ): Promise<InventoryBranch> {
    return this.locations.createBranch(owner.merchantId, owner.username, input);
  }

  @Get('branches/:branchId')
  getBranch(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
  ): Promise<InventoryBranch> {
    return this.locations.getBranch(owner.merchantId, branchId);
  }

  @Patch('branches/:branchId')
  updateBranch(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body(new ZodValidationPipe(updateInventoryBranchSchema, { format: 'messages' }))
    input: UpdateInventoryBranchRequest,
  ): Promise<InventoryBranch> {
    return this.locations.updateBranch(owner.merchantId, owner.username, branchId, input);
  }

  @Post('branches/:branchId/archive')
  archiveBranch(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body(new ZodValidationPipe(stockItemRevisionSchema, { format: 'messages' }))
    input: StockItemRevisionRequest,
  ): Promise<InventoryBranch> {
    return this.locations.setBranchArchived(
      owner.merchantId,
      owner.username,
      branchId,
      true,
      input,
    );
  }

  @Post('branches/:branchId/restore')
  restoreBranch(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body(new ZodValidationPipe(stockItemRevisionSchema, { format: 'messages' }))
    input: StockItemRevisionRequest,
  ): Promise<InventoryBranch> {
    return this.locations.setBranchArchived(
      owner.merchantId,
      owner.username,
      branchId,
      false,
      input,
    );
  }

  @Post('branches/:branchId/warehouses')
  createWarehouse(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body(new ZodValidationPipe(createInventoryWarehouseSchema, { format: 'messages' }))
    input: CreateInventoryWarehouseRequest,
  ): Promise<InventoryBranch> {
    return this.locations.createWarehouse(owner.merchantId, owner.username, branchId, input);
  }

  @Patch('branches/:branchId/warehouses/:warehouseId')
  updateWarehouse(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('warehouseId', new ParseUUIDPipe()) warehouseId: string,
    @Body(new ZodValidationPipe(updateInventoryWarehouseSchema, { format: 'messages' }))
    input: UpdateInventoryWarehouseRequest,
  ): Promise<InventoryBranch> {
    return this.locations.updateWarehouse(
      owner.merchantId,
      owner.username,
      branchId,
      warehouseId,
      input,
    );
  }

  @Patch('branches/:branchId/default-consumption-warehouse')
  setDefaultWarehouse(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body(new ZodValidationPipe(setDefaultConsumptionWarehouseSchema, { format: 'messages' }))
    input: { revision: number; warehouseId: string },
  ): Promise<InventoryBranch> {
    return this.locations.setDefaultConsumptionWarehouse(
      owner.merchantId,
      owner.username,
      branchId,
      input,
    );
  }

  @Post('branches/:branchId/warehouses/:warehouseId/archive')
  archiveWarehouse(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('warehouseId', new ParseUUIDPipe()) warehouseId: string,
    @Body(new ZodValidationPipe(stockItemRevisionSchema, { format: 'messages' }))
    input: StockItemRevisionRequest,
  ): Promise<InventoryBranch> {
    return this.locations.setWarehouseArchived(
      owner.merchantId,
      owner.username,
      branchId,
      warehouseId,
      true,
      input,
    );
  }

  @Post('branches/:branchId/warehouses/:warehouseId/restore')
  restoreWarehouse(
    @CurrentOwner() owner: OwnerProfile,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('warehouseId', new ParseUUIDPipe()) warehouseId: string,
    @Body(new ZodValidationPipe(stockItemRevisionSchema, { format: 'messages' }))
    input: StockItemRevisionRequest,
  ): Promise<InventoryBranch> {
    return this.locations.setWarehouseArchived(
      owner.merchantId,
      owner.username,
      branchId,
      warehouseId,
      false,
      input,
    );
  }

  @Get('policy')
  getPolicy(@CurrentOwner() owner: OwnerProfile): Promise<InventoryPolicy> {
    return this.locations.getPolicy(owner.merchantId);
  }

  @Patch('policy')
  updatePolicy(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(inventoryPolicyUpdateSchema, { format: 'messages' }))
    input: UpdateInventoryPolicyRequest,
  ): Promise<InventoryPolicy> {
    return this.locations.updatePolicy(owner.merchantId, owner.username, input);
  }

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

  @Post('opening-balances')
  createOpening(
    @CurrentOwner() owner: OwnerProfile,
    @Body(new ZodValidationPipe(createStockOpeningSchema, { format: 'messages' }))
    input: CreateStockOpeningRequest,
  ): Promise<StockMovementBatchResult> {
    return this.ledger.createOpening(owner.merchantId, owner.username, input);
  }
}
