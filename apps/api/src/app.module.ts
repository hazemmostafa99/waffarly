import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule, HealthModule],
})
export class AppModule {}
