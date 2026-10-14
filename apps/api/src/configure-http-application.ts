import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
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
  app.use(
    morgan(
      (tokens, request, response) => {
        const rawStatusCode = tokens.status?.(request, response);
        const rawDurationMs = tokens['response-time']?.(request, response);
        const rawResponseBytes = tokens.res?.(request, response, 'content-length');
        const statusCode = rawStatusCode === undefined ? undefined : Number(rawStatusCode);
        const durationMs = rawDurationMs === undefined ? undefined : Number(rawDurationMs);
        const responseBytes = rawResponseBytes === undefined ? undefined : Number(rawResponseBytes);

        return JSON.stringify({
          event: 'http.request',
          method: tokens.method?.(request, response) ?? request.method,
          path: tokens.url?.(request, response) ?? request.url,
          ...(typeof statusCode === 'number' && Number.isFinite(statusCode) ? { statusCode } : {}),
          ...(typeof durationMs === 'number' && Number.isFinite(durationMs)
            ? { durationMs: Number(durationMs.toFixed(2)) }
            : {}),
          ...(typeof responseBytes === 'number' && Number.isFinite(responseBytes)
            ? { responseBytes }
            : {}),
        });
      },
      {
        stream: {
          write: (message: string) => {
            const trimmedMessage = message.trim();
            let record: Record<string, unknown>;

            try {
              const parsed: unknown = JSON.parse(trimmedMessage);
              record =
                typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
                  ? (parsed as Record<string, unknown>)
                  : { message: trimmedMessage };
            } catch {
              record = { message: trimmedMessage };
            }

            const statusCode = typeof record.statusCode === 'number' ? record.statusCode : 0;
            if (statusCode >= 500) {
              logger.error(record, 'HttpAccessLog');
            } else if (statusCode >= 400) {
              logger.warn(record, 'HttpAccessLog');
            } else {
              logger.log(record, 'HttpAccessLog');
            }
          },
        },
      },
    ),
  );
  app.getHttpAdapter().useStaticAssets?.(config.mediaStorageDirectory, {
    prefix: '/media',
    dotfiles: 'deny',
    fallthrough: true,
    index: false,
    immutable: true,
    maxAge: '1y',
    setHeaders: (response: { setHeader(name: string, value: string): unknown }) =>
      response.setHeader('X-Content-Type-Options', 'nosniff'),
  });
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
