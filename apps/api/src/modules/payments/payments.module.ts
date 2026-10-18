import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { ShiftsModule } from '../shifts/index.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [AuthModule, ShiftsModule],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
