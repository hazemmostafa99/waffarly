import { Module } from '@nestjs/common';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
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
  controllers: [AuthController, PosEmployeesController, CustomerAuthController],
  providers: [
    AuthService,
    AdminGuard,
    OwnerGuard,
    PosEmployeeGuard,
    PosEmployeeService,
    CustomerAuthService,
  ],
  exports: [AuthService, AdminGuard, OwnerGuard, PosEmployeeGuard, CustomerAuthService],
})
export class AuthModule {}
