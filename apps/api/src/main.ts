import 'reflect-metadata';
import { config as loadDotEnv } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureHttpApplication } from './configure-http-application.js';
import { StructuredLogger } from './common/logging/structured-logger.js';
import { AppConfiguration } from './config/app-configuration.js';

loadDotEnv({ path: [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')] });

async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger();
  const app = await NestFactory.create(AppModule, { logger });
  const config = app.get(AppConfiguration);

  configureHttpApplication(app, config, logger);
  app.enableShutdownHooks();

  const port = config.port;
  await app.listen(port, '0.0.0.0');
  logger.log(`Waffarly API listening on port ${port}`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  const logger = new StructuredLogger();
  logger.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
    'Bootstrap',
  );
  process.exitCode = 1;
});
