import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppConfiguration } from '../../config/app-configuration.js';
import { createPostgresAdapter, PrismaClient } from '@waffarly/database';
import { StructuredLogger } from '../../common/logging/structured-logger.js';
import { waitForDatabase } from './database-startup.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy, OnModuleInit {
  private readonly startupOptions;
  private readonly startupLogger = new StructuredLogger();

  constructor(@Inject(AppConfiguration) config: AppConfiguration) {
    super({
      adapter: createPostgresAdapter(config.databaseUrl, {
        ...config.databasePoolOptions,
        onPoolError: () =>
          new StructuredLogger().warn(
            { event: 'database.pool.error', message: 'An idle database connection was lost.' },
            'PrismaService',
          ),
      }),
    });
    this.startupOptions = config.databaseStartupOptions;
  }

  async onModuleInit(): Promise<void> {
    try {
      await waitForDatabase(
        () => this.$queryRaw`SELECT 1`,
        this.startupOptions,
        (attempt, delayMs) =>
          this.startupLogger.warn(
            { event: 'database.startup.retry', attempt, delayMs },
            'PrismaService',
          ),
      );
      this.startupLogger.log({ event: 'database.connected' }, 'PrismaService');
    } catch (error) {
      await this.$disconnect();
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
