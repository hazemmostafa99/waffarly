import type { INestApplication } from '@nestjs/common';
import { AppConfiguration } from './config/app-configuration.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { StructuredLogger } from './common/logging/structured-logger.js';

export function configureHttpApplication(
  app: INestApplication,
  config: AppConfiguration,
  logger: StructuredLogger,
): void {
  app.enableCors({ origin: config.corsOrigins, credentials: false });
  app.useGlobalFilters(new HttpExceptionFilter(logger));
}
