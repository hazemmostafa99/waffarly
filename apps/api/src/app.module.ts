import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { SuperAdminModule } from './modules/super-admin/super-admin.module.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule, HealthModule, AuthModule, SuperAdminModule],
})
export class AppModule {}
