import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

export interface ValidationOptions {
  format?: 'issues' | 'messages';
  fallbackPath?: string;
  message?: string;
}

/** Shared by HTTP pipes and parsing helpers; preserve each endpoint's error format. */
export function parseRequest<T>(
  schema: z.ZodType<T>,
  value: unknown,
  options: ValidationOptions = {},
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  if (options.message) throw new BadRequestException(options.message);
  if (options.format === 'messages') {
    throw new BadRequestException(
      result.error.issues.map(
        (issue) => `${issue.path.join('.') || options.fallbackPath || ''}: ${issue.message}`,
      ),
    );
  }
  throw new BadRequestException(result.error.issues);
}

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: z.ZodType<T>,
    private readonly options: ValidationOptions = {},
  ) {}

  transform(value: unknown): T {
    return parseRequest(this.schema, value, this.options);
  }
}
