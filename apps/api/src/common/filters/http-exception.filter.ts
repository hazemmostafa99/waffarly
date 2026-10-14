import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StructuredLogger } from '../logging/structured-logger.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: Record<string, unknown> | undefined =
      typeof exceptionBody === 'object' && exceptionBody !== null
        ? (exceptionBody as Record<string, unknown>)
        : undefined;
    const messageValue = body?.message ?? exceptionBody;
    const message =
      typeof messageValue === 'string' || Array.isArray(messageValue)
        ? messageValue
        : statusCode >= 500
          ? 'Internal server error'
          : 'Request failed';
    const errorCode = typeof body?.code === 'string' ? body.code : undefined;

    if (statusCode >= 500) {
      const error = exception instanceof Error ? exception : undefined;
      const errorWithMetadata =
        typeof exception === 'object' && exception !== null
          ? (exception as { code?: unknown; meta?: unknown })
          : {};
      const databaseCode =
        typeof errorWithMetadata.code === 'string' ? errorWithMetadata.code : undefined;
      const databaseMeta =
        typeof errorWithMetadata.meta === 'object' && errorWithMetadata.meta !== null
          ? errorWithMetadata.meta
          : undefined;
      const databaseMetaRecord =
        typeof databaseMeta === 'object' && databaseMeta !== null
          ? (databaseMeta as Record<string, unknown>)
          : undefined;
      const missingTable =
        typeof databaseMetaRecord?.table === 'string' ? databaseMetaRecord.table : undefined;
      const path = request.originalUrl ?? request.url;

      this.logger.error(
        {
          event: 'http.exception',
          method: request.method,
          path,
          statusCode,
          ...(error
            ? { errorName: error.name, detail: error.message }
            : { detail: String(exception) }),
          ...(databaseCode ? { databaseCode } : {}),
          ...(databaseMeta ? { databaseMeta } : {}),
          ...(missingTable ? { summary: `Database table "${missingTable}" is missing.` } : {}),
          ...(error?.stack ? { stack: error.stack } : {}),
          ...(databaseCode === 'P2021'
            ? {
                hint: 'The database table is missing. Run "pnpm db:migrate" against the same DATABASE_URL.',
              }
            : {}),
        },
        'HttpExceptionFilter',
      );
    }

    response.status(statusCode).json({
      statusCode,
      ...(errorCode ? { errorCode } : {}),
      message,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
