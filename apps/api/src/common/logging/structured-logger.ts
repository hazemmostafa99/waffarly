import type { LoggerService } from '@nestjs/common';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'verbose' | 'fatal';

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
    const context = optionalParams.find((value) => typeof value === 'string');
    const logRecord = {
      timestamp: new Date().toISOString(),
      level,
      ...(typeof context === 'string' ? { context } : {}),
      message: message instanceof Error ? message.message : String(message),
      ...(message instanceof Error && message.stack ? { stack: message.stack } : {}),
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
}
