import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module.js';
import { AuthModule } from '../auth/index.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
@Module({
  imports: [AuthModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
