import { ConflictException } from '@nestjs/common';

/** Validate persisted money before exposing or recording it as EGP. */
export function requireEgpCurrency(value: string): 'EGP' {
  if (value !== 'EGP') throw new ConflictException('Currency must be EGP.');
  return value;
}

/** Parse non-negative decimal amounts without floating-point rounding. */
export function toCents(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new ConflictException('Product has an invalid price configuration.');
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

export function toSignedCents(value: string): bigint {
  return value.startsWith('-') ? -toCents(value.slice(1)) : toCents(value);
}

export function formatCents(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absoluteValue = value < 0n ? -value : value;
  return `${sign}${absoluteValue / 100n}.${(absoluteValue % 100n).toString().padStart(2, '0')}`;
}
