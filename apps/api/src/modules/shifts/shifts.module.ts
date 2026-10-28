import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import {
  OwnerPosRegistersController,
  OwnerPosShiftReportsController,
  PosShiftsController,
} from './shifts.controller.js';
import { ShiftsService } from './shifts.service.js';
import { CashCustodyService } from './cash-custody.service.js';
import { OwnerCashCustodyController, PosCashCustodyController } from './cash-custody.controller.js';

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
