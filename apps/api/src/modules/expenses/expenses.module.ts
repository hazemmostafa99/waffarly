import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module.js';
import { AuthModule } from '../auth/index.js';
import { ShiftsModule } from '../shifts/index.js';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';

@Module({
  imports: [AuthModule, ShiftsModule, StorageModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
