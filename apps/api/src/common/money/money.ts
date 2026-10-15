import { ConflictException } from '@nestjs/common';

/** Parse non-negative decimal amounts without floating-point rounding. */
export function toCents(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new ConflictException('Product has an invalid price configuration.');
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

export function formatCents(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}
