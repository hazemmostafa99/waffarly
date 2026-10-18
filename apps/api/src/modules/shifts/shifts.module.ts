import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { OwnerPosRegistersController, PosShiftsController } from './shifts.controller.js';
import { ShiftsService } from './shifts.service.js';

@Module({
  imports: [AuthModule],
  controllers: [OwnerPosRegistersController, PosShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
