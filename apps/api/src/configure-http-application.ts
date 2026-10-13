import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfiguration } from './config/app-configuration.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { StructuredLogger } from './common/logging/structured-logger.js';

export function configureHttpApplication(
  app: INestApplication,
  config: AppConfiguration,
  logger: StructuredLogger,
): void {
  const allowedOrigins = new Set(config.corsOrigins);
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.headers.origin &&
      !allowedOrigins.has(request.headers.origin)
    ) {
      response.status(403).json({ message: 'Request origin is not allowed.' });
      return;
    }
    next();
  });
  app.useGlobalFilters(new HttpExceptionFilter(logger));
}
