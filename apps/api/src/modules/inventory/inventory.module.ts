import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryLedgerService } from './inventory-ledger.service.js';
import { InventoryLocationsController } from './inventory-locations.controller.js';
import { InventoryLocationsService } from './inventory-locations.service.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController, InventoryLocationsController],
  providers: [InventoryService, InventoryLocationsService, InventoryLedgerService],
  exports: [InventoryService, InventoryLedgerService],
})
export class InventoryModule {}
