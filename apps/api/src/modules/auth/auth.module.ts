import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OwnerGuard } from './owner.guard.js';
import { PosEmployeeGuard } from './pos-employee.guard.js';
import { PosEmployeesController } from './pos-employees.controller.js';
import { PosEmployeeService } from './pos-employee.service.js';
import { SubscriptionsModule } from '../subscriptions/index.js';

@Module({
  imports: [SubscriptionsModule],
  controllers: [AuthController, PosEmployeesController],
  providers: [AuthService, AdminGuard, OwnerGuard, PosEmployeeGuard, PosEmployeeService],
  exports: [AuthService, AdminGuard, OwnerGuard, PosEmployeeGuard],
})
export class AuthModule {}
