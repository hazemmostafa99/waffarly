import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { parseRequest } from './zod-validation.pipe.js';

const cursorPageSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CursorPageQuery = z.infer<typeof cursorPageSchema>;

export function parseCursorPageQuery(query: unknown): CursorPageQuery {
  return parseRequest(cursorPageSchema, query);
}

export function assertScopedCursor(cursor: string | undefined, exists: boolean): void {
  if (cursor && !exists) throw new BadRequestException('Pagination cursor is invalid.');
}
