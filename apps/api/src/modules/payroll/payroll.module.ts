import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/index.js';
import { AuthModule } from '../auth/index.js';
import { EmployeesModule } from '../employees/index.js';
import { ShiftsModule } from '../shifts/index.js';
import { PayrollController } from './payroll.controller.js';
import { PayrollService } from './payroll.service.js';

@Module({
  imports: [AuthModule, EmployeesModule, AttendanceModule, ShiftsModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
