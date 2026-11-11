import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/index.js';
import { DiscountsController } from './discounts.controller.js';
import { DiscountsService } from './discounts.service.js';

@Module({ imports: [AuthModule], controllers: [DiscountsController], providers: [DiscountsService] })
export class DiscountsModule {}
