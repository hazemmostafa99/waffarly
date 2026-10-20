import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { ProductConfigurationReportController } from './product-configuration-report.controller.js';
import { ProductConfigurationReportService } from './product-configuration-report.service.js';
import { PosOperationsReportController } from './pos-operations-report.controller.js';
import { PosOperationsReportService } from './pos-operations-report.service.js';
@Module({
  imports: [AuthModule],
  controllers: [ProductConfigurationReportController, PosOperationsReportController],
  providers: [ProductConfigurationReportService, PosOperationsReportService],
})
export class ReportsModule {}
