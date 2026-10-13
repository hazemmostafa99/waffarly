import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { AppConfiguration } from '../../config/app-configuration.js';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(AppConfiguration) config: AppConfiguration) {
    super({ adapter: createPostgresAdapter(config.databaseUrl) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
