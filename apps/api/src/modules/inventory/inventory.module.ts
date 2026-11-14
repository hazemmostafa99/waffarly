import { InventoryHealthController } from './visibility/stock-health.controller.js';
import { InventoryLedgerController } from './ledger/inventory-ledger.controller.js';
import { InventoryPolicyController } from './policy/inventory-policy.controller.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryLedgerService } from './inventory-ledger.service.js';
import { InventoryLocationsController } from './inventory-locations.controller.js';
import { InventoryLocationsService } from './inventory-locations.service.js';
import { InventoryVisibilityService } from './inventory-visibility.service.js';
import { InventoryService } from './inventory.service.js';
import { EmployeeInventoryController } from './employee-inventory.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [
    InventoryPolicyController,
    InventoryLedgerController,
    InventoryHealthController,
    InventoryController,
    InventoryLocationsController,
    EmployeeInventoryController,
  ],
  providers: [
    InventoryService,
    InventoryLocationsService,
    InventoryLedgerService,
    InventoryVisibilityService,
  ],
  exports: [InventoryService, InventoryLedgerService],
})
export class InventoryModule {}
