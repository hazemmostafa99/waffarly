import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MerchantController } from './merchant.controller.js';
import {
  AdminMerchantApplicationController,
  PublicMerchantApplicationController,
} from './merchant-application.controller.js';
import { MerchantService } from './merchant.service.js';
import { TemplateController } from './template.controller.js';
import { TemplateService } from './template.service.js';
import { PlanController } from './plan.controller.js';
import { PlanService } from './plan.service.js';
import { ActivitiesModulesController } from './activities-modules.controller.js';
import { ActivitiesModulesService } from './activities-modules.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    MerchantController,
    PublicMerchantApplicationController,
    AdminMerchantApplicationController,
    TemplateController,
    PlanController,
    ActivitiesModulesController,
  ],
  providers: [MerchantService, TemplateService, PlanService, ActivitiesModulesService],
})
export class SuperAdminModule {}
