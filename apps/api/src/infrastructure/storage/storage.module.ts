import { Module } from '@nestjs/common';
import { LocalMediaStorage } from './local-media-storage.js';
import { MediaStorage } from './media-storage.js';

@Module({
  providers: [{ provide: MediaStorage, useClass: LocalMediaStorage }],
  exports: [MediaStorage],
})
export class StorageModule {}
