import type { INestApplication } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import type { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import { AppConfiguration } from './config/app-configuration.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { StructuredLogger } from './common/logging/structured-logger.js';
import { MerchantService, storefrontRequestScope } from './modules/merchants/index.js';

export function configureHttpApplication(
  app: INestApplication,
  config: AppConfiguration,
  logger: StructuredLogger,
): void {
  const allowedOrigins = new Set(config.corsOrigins);
  const decisions = new WeakMap<Request, Promise<boolean>>();
  const registeredStorefrontRequest = (request: Request): Promise<boolean> => {
    const cached = decisions.get(request);
    if (cached) return cached;
    const decision = (async () => {
      if (!request.headers.origin) return false;
      const scope = storefrontRequestScope(
        request.headers.origin,
        request.method,
        request.path,
        config.corsOrigins,
        config.storefrontBaseDomain,
        config.isDevelopment,
      );
      if (!scope) return false;
      try {
        const address = await app.get(MerchantService).resolveStorefrontHandle(scope.handle);
        return scope.slug === null || address.storefrontSlug === scope.slug;
      } catch {
        return false;
      } // Fail closed, including unavailable database/unknown handle.
    })();
    decisions.set(request, decision);
    return decision;
  };
  app.enableCors(
    (request: Request, callback: (error: Error | null, options: CorsOptions) => void) => {
      if (request.headers.origin && allowedOrigins.has(request.headers.origin)) {
        callback(null, { origin: request.headers.origin, credentials: true });
        return;
      }
      void registeredStorefrontRequest(request).then((allowed) =>
        callback(null, {
          origin: allowed ? request.headers.origin! : false,
          credentials: allowed && request.path.startsWith('/auth/customer/'),
          methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type'],
        }),
      );
    },
  );
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
      void registeredStorefrontRequest(request).then((allowed) => {
        if (allowed) next();
        else response.status(403).json({ message: 'Request origin is not allowed.' });
      });
      return;
    }
    next();
  });
  app.useGlobalFilters(new HttpExceptionFilter(logger));
}
