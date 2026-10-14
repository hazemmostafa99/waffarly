import type { LoggerService } from '@nestjs/common';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'verbose' | 'fatal';
type LogFields = Record<string, unknown>;

export class StructuredLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    const stringParams = optionalParams.filter(
      (value): value is string => typeof value === 'string',
    );
    const context = stringParams[stringParams.length - 1];
    const fields = { ...this.toFields(message) };
    const supplementalStack =
      level === 'error' || level === 'fatal'
        ? optionalParams[0] !== context && typeof optionalParams[0] === 'string'
          ? optionalParams[0]
          : undefined
        : undefined;

    if (supplementalStack && !fields.stack) fields.stack = supplementalStack;

    const logRecord: LogFields = {
      timestamp: new Date().toISOString(),
      level,
      ...(typeof context === 'string' ? { context } : {}),
      ...fields,
    };
    const serialized = JSON.stringify(logRecord);

    if (level === 'error' || level === 'fatal') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  private toFields(message: unknown): LogFields {
    if (message instanceof Error) {
      return {
        message: message.message,
        errorName: message.name,
        ...(message.stack ? { stack: message.stack } : {}),
      };
    }

    if (this.isLogFields(message)) return message;

    if (typeof message === 'string') {
      const parsed = this.parseFields(message);
      if (parsed) return parsed;
      return { message };
    }

    return { message: String(message) };
  }

  private parseFields(message: string): LogFields | undefined {
    try {
      const parsed: unknown = JSON.parse(message);
      return this.isLogFields(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  private isLogFields(value: unknown): value is LogFields {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
