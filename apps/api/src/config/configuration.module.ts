import { Global, Module } from '@nestjs/common';
import { AppConfiguration } from './app-configuration.js';

@Global()
@Module({
  providers: [AppConfiguration],
  exports: [AppConfiguration],
})
export class ConfigurationModule {}
