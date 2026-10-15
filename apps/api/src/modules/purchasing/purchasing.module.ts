import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { InventoryModule } from '../inventory/index.js';
import { PurchaseSuppliersService } from './purchase-suppliers.service.js';
import { PurchasingController } from './purchasing.controller.js';
import { PurchasingService } from './purchasing.service.js';

@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [PurchasingController],
  providers: [PurchaseSuppliersService, PurchasingService],
})
export class PurchasingModule {}
