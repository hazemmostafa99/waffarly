import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';

export function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function replayAction<T>(
  previous: { action: string; fingerprint: string; createdBy: string; result: unknown },
  actor: string,
  fingerprint: string,
  action: string,
): T {
  if (
    previous.action !== action ||
    previous.createdBy !== actor ||
    previous.fingerprint !== fingerprint
  )
    throw new ConflictException('The request ID was already used for a different POS action.');
  return previous.result as T;
}
