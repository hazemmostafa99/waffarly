import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { PlanController } from './plan.controller.js';
import { PlanService } from './plan.service.js';
@Module({
  imports: [AuthModule],
  controllers: [PlanController],
  providers: [PlanService],
})
export class PlansModule {}
