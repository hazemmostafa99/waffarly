import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { ActivitiesModulesController } from './activities-modules.controller.js';
import { ActivitiesModulesService } from './activities-modules.service.js';
@Module({
  imports: [AuthModule],
  controllers: [ActivitiesModulesController],
  providers: [ActivitiesModulesService],
})
export class ActivitiesModule {}
