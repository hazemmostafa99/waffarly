import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { OwnerPosRegistersController } from './http/owner/registers.controller.js';
import { OwnerPosShiftReportsController } from './http/owner/shift-reports.controller.js';
import { PosShiftsController } from './http/pos/shifts.controller.js';
import { ShiftsService } from './shifts.service.js';
import { CashCustodyService } from './cash-custody.service.js';
import { OwnerCashCustodyController } from './http/owner/cash-custody.controller.js';
import { PosCashCustodyController } from './http/pos/cash-custody.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [
    OwnerPosRegistersController,
    OwnerPosShiftReportsController,
    PosShiftsController,
    OwnerCashCustodyController,
    PosCashCustodyController,
  ],
  providers: [ShiftsService, CashCustodyService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
