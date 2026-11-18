/** Connects owner employee management with authentication and branch checks. */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { PosEmployeeService } from './pos-employee.service.js';
import { PosEmployeesController } from './pos-employees.controller.js';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';
@Module({
  imports: [AuthModule],
  controllers: [PosEmployeesController, StaffController],
  providers: [PosEmployeeService, StaffService],
  exports: [StaffService],
})
export class EmployeesModule {}
