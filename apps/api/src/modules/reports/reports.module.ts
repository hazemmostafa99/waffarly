import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { ProductConfigurationReportController } from './product-configuration-report.controller.js';
import { ProductConfigurationReportService } from './product-configuration-report.service.js';
@Module({
  imports: [AuthModule],
  controllers: [ProductConfigurationReportController],
  providers: [ProductConfigurationReportService],
})
export class ReportsModule {}
