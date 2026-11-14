/** Connects owner employee management with authentication and branch checks. */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { PosEmployeeService } from './pos-employee.service.js';
import { PosEmployeesController } from './pos-employees.controller.js';
@Module({
  imports: [AuthModule],
  controllers: [PosEmployeesController],
  providers: [PosEmployeeService],
})
export class EmployeesModule {}
