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
      const detail = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        JSON.stringify({ event: 'http.exception', statusCode, path: request.url, detail }),
        'HttpExceptionFilter',
      );
    }

    response.status(statusCode).json({
      statusCode,
      ...(errorCode ? { errorCode } : {}),
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
