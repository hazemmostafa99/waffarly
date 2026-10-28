import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { PlanController } from './plan.controller.js';
import { PlanService } from './plan.service.js';
import { SubscriptionsModule } from '../subscriptions/index.js';
import { SubscriptionsController } from './subscriptions.controller.js';
@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [PlanController, SubscriptionsController],
  providers: [PlanService],
})
export class PlansModule {}
