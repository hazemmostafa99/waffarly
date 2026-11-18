import { Module } from '@nestjs/common';
import { LocalMediaStorage } from './local-media-storage.js';
import { MediaStorage } from './media-storage.js';
import { PrivateMediaStorage } from './private-media-storage.js';

@Module({
  providers: [{ provide: MediaStorage, useClass: LocalMediaStorage }, PrivateMediaStorage],
  exports: [MediaStorage, PrivateMediaStorage],
})
export class StorageModule {}
