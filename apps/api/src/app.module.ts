import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { ActivitiesModule } from './modules/activities/index.js';
import { AuthModule } from './modules/auth/index.js';
import { CatalogModule } from './modules/catalog/index.js';
import { HealthModule } from './modules/health/index.js';
import { MediaModule } from './modules/media/index.js';
import { MerchantsModule } from './modules/merchants/index.js';
import { OrdersModule } from './modules/orders/index.js';
import { PlansModule } from './modules/plans/index.js';
import { ReportsModule } from './modules/reports/index.js';
import { StorefrontModule } from './modules/storefront/index.js';
@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    MerchantsModule,
    PlansModule,
    ActivitiesModule,
    StorefrontModule,
    CatalogModule,
    OrdersModule,
    MediaModule,
    ReportsModule,
  ],
})
export class AppModule {}
