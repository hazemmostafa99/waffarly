import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { ProductConfigurationReportController } from './product-configuration-report.controller.js';
import { ProductConfigurationReportService } from './product-configuration-report.service.js';
import { PosOperationsReportController } from './pos-operations-report.controller.js';
import { PosOperationsReportService } from './pos-operations-report.service.js';
import { ProductProfitabilityReportController } from './product-profitability-report.controller.js';
import { ProductProfitabilityReportService } from './product-profitability-report.service.js';
import { BusinessReportController } from './business-report.controller.js';
import { BusinessReportService } from './business-report.service.js';
@Module({
  imports: [AuthModule],
  controllers: [ProductConfigurationReportController, PosOperationsReportController, ProductProfitabilityReportController, BusinessReportController],
  providers: [ProductConfigurationReportService, PosOperationsReportService, ProductProfitabilityReportService, BusinessReportService],
})
export class ReportsModule {}
